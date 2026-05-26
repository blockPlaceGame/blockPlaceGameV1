const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const zlib = require('zlib');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- GLOBAL RAM CACHE ---
const boardCache = {};
let rawBinaryCache = Buffer.alloc(0);
let compressedBinaryCache = Buffer.alloc(0);
let serverConfig = { width: 100, height: 100, cooldownMs: 15000 };

// --- BLOCK ID DICTIONARY ---
const blockIds = {
    "dirt": 1, "cobblestone": 2, "oak_planks": 3, "stone": 4, "sand": 5, "gravel": 6, "oak_log": 7, "oak_leaves": 8, "glass": 9, "bricks": 10, "obsidian": 11, "netherrack": 12, "soul_sand": 13, "glowstone": 14, "white_wool": 15, "diamond_block": 16, "orange_wool": 17, "magenta_wool": 18, "light_blue_wool": 19, "yellow_wool": 20, "lime_wool": 21, "pink_wool": 22, "gray_wool": 23, "light_gray_wool": 24, "cyan_wool": 25, "purple_wool": 26, "blue_wool": 27, "brown_wool": 28, "green_wool": 29, "red_wool": 30, "black_wool": 31, "gold_block": 32, "iron_block": 33, "emerald_block": 34, "redstone_block": 35, "lapis_block": 36, "coal_block": 37, "bookshelf": 38, "sponge": 39, "bedrock": 40, "white_concrete": 41, "orange_concrete": 42, "magenta_concrete": 43, "light_blue_concrete": 44, "yellow_concrete": 45, "lime_concrete": 46, "pink_concrete": 47, "gray_concrete": 48, "light_gray_concrete": 49, "cyan_concrete": 50, "purple_concrete": 51, "blue_concrete": 52, "brown_concrete": 53, "green_concrete": 54, "red_concrete": 55, "black_concrete": 56, "acacia_planks": 57, "birch_planks": 58, "jungle_planks": 59, "spruce_planks": 60, "dark_oak_planks": 61, "andesite": 62, "diorite": 63, "granite": 64, "polished_andesite": 65, "polished_diorite": 66, "polished_granite": 67, "clay": 68, "snow": 69, "packed_ice": 70
};

// --- BINARY SERIALIZER ---
function serializeBoard(cache) {
    const pixels = Object.values(cache);
    let totalSize = 0;

    // Pass 1: Calculate exact buffer size needed (No temporary objects created!)
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        const userLen = Buffer.byteLength(p.username || "Unknown", 'utf8');
        totalSize += 6 + userLen; // X(2 bytes) + Y(2 bytes) + Color(1 byte) + UsernameLength(1 byte) + UsernameText
    }

    // Pass 2: Allocate one single buffer and write directly to it
    const buffer = Buffer.allocUnsafe(totalSize);
    let offset = 0;
    
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        const blockId = blockIds[p.color] || 41;
        const userStr = p.username || "Unknown";
        const userLenBytes = Buffer.byteLength(userStr, 'utf8');
        const userLen = Math.min(userLenBytes, 255);

        buffer.writeUInt16LE(p.x, offset); offset += 2;
        buffer.writeUInt16LE(p.y, offset); offset += 2;
        buffer.writeUInt8(blockId, offset); offset += 1;
        buffer.writeUInt8(userLen, offset); offset += 1;
        buffer.write(userStr, offset, userLen, 'utf8'); offset += userLen;
    }
    
    return buffer;
}

// Serve static files from the current directory
app.use(express.static(__dirname));
// Parse incoming JSON requests for our Login API
app.use(express.json());

// Initialize PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Required for most free cloud databases
});

pool.connect(async (err, client, release) => {
    if (err) {
        console.error("Error opening database " + err.message);
    } else {
        console.log("Connected to the PostgreSQL database.");
        try {
            await client.query(`CREATE TABLE IF NOT EXISTS pixels (
            x INTEGER,
            y INTEGER,
            color TEXT,
            username TEXT,
            PRIMARY KEY (x, y)
            )`);
            console.log("Pixels table ready.");
            
            // Safely patch existing databases to include the username column
            await client.query(`ALTER TABLE pixels ADD COLUMN IF NOT EXISTS username TEXT`);
            
            // Enable RLS to secure the table from direct Supabase API access
            await client.query(`ALTER TABLE pixels ENABLE ROW LEVEL SECURITY`);

            await client.query(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
                last_placed_time BIGINT
            )`);
            console.log("Users table ready.");

            // Safely patch existing databases to include the password column
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
            
            // Enable RLS to secure the table from direct Supabase API access
            await client.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);

            // Create settings table for dynamic canvas sizing
            await client.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
            await client.query(`INSERT INTO settings (key, value) VALUES ('grid_width', '100'), ('grid_height', '100'), ('cooldown_seconds', '15') ON CONFLICT DO NOTHING`);
            console.log("Settings table ready.");
            
            // Enable RLS to secure the table from direct Supabase API access
            await client.query(`ALTER TABLE settings ENABLE ROW LEVEL SECURITY`);

            // --- INITIALIZE RAM CACHE ON STARTUP ---
            const configRes = await client.query("SELECT key, value FROM settings WHERE key IN ('grid_width', 'grid_height', 'cooldown_seconds')");
            configRes.rows.forEach(row => {
                if (row.key === 'grid_width') serverConfig.width = parseInt(row.value);
                if (row.key === 'grid_height') serverConfig.height = parseInt(row.value);
                if (row.key === 'cooldown_seconds') serverConfig.cooldownMs = parseInt(row.value) * 1000;
            });
            console.log("Settings loaded into RAM cache.");

            const boardRes = await client.query("SELECT x, y, color, username FROM pixels");
            boardRes.rows.forEach(p => {
                boardCache[`${p.x},${p.y}`] = p;
            });
            console.log(`Loaded ${boardRes.rows.length} pixels into RAM cache.`);

            // Help the Garbage Collector: Clear the massive SQL array before doing binary math
            boardRes.rows.length = 0; 

            // Build the initial binary cache
            rawBinaryCache = serializeBoard(boardCache);
            compressedBinaryCache = zlib.gzipSync(rawBinaryCache);
            console.log(`Serialized board to binary cache: ${rawBinaryCache.length} bytes (Compressed: ${compressedBinaryCache.length} bytes).`);
        } catch (error) {
            console.error("Error initializing tables", error);
        } finally {
            release();
        }
    }
});

// --- LOGIN AND REGISTRATION API ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const hash = await bcrypt.hash(password, 10);
        // Insert new user. If username exists, postgres throws a unique violation (23505)
        await pool.query(`INSERT INTO users (username, password_hash, last_placed_time) VALUES ($1, $2, 0)`, [username, hash]);
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const result = await pool.query(`SELECT password_hash FROM users WHERE username = $1`, [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
        
        const match = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid username or password' });
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Broadcast new player count
    io.emit('playerCountUpdate', io.engine.clientsCount);

    let cooldownMs = serverConfig.cooldownMs;

    try {
        // Send configuration and board state instantly from RAM cache
        socket.emit('initConfig', { width: serverConfig.width, height: serverConfig.height });
        socket.emit('initBoard', compressedBinaryCache);
        console.log(`Sent full board state as compressed binary (${compressedBinaryCache.length} bytes) to ${socket.id}`);
    } catch (err) {
        console.error("Error sending initial data: " + err.message);
    }

    // Check if user is on cooldown upon connecting
    socket.on('checkCooldown', (username) => {
        if (!username) return;
        const now = Date.now();

        pool.query(`SELECT last_placed_time FROM users WHERE username = $1`, [username], (err, res) => {
            if (err) return console.error("Error checking user cooldown on connect: " + err.message);
            
            let lastPlaced = res.rows.length > 0 ? res.rows[0].last_placed_time : 0;
            // Parse string to int because Postgres BIGINT returns as string in Node.js
            let timePassed = now - parseInt(lastPlaced);

            if (timePassed < cooldownMs) {
                const remainingMs = cooldownMs - timePassed;
                socket.emit('cooldownStatus', { remainingMs });
            }
        });
    });

    socket.on('pixelPlaced', (data) => {
        const { x, y, color, username } = data;
        if (!username) return;

        const now = Date.now();

        pool.query(`SELECT last_placed_time FROM users WHERE username = $1`, [username], (err, res) => {
            if (err) return console.error("Error checking user cooldown: " + err.message);
            
            let lastPlaced = res.rows.length > 0 ? res.rows[0].last_placed_time : 0;
            let timePassed = now - parseInt(lastPlaced);

            if (timePassed < cooldownMs) {
                // Reject the placement
                const remainingMs = cooldownMs - timePassed;
                console.log(`User ${username} rejected. Cooldown active for ${remainingMs}ms.`);
                socket.emit('pixelRejected', { remainingMs });
            } else {
                // Accept the placement immediately in RAM cache
                console.log(`Pixel accepted at X:${x}, Y:${y} with color ${color} by ${username}`);
                boardCache[`${x},${y}`] = { x, y, color, username };

                // Efficiently append ONLY the new pixel to the raw binary cache (Saves massive CPU!)
                const newPixelBuffer = serializeBoard({ "temp": { x, y, color, username } });
                rawBinaryCache = Buffer.concat([rawBinaryCache, newPixelBuffer]);

                // Asynchronously update the compressed cache in the background (Non-blocking!)
                zlib.gzip(rawBinaryCache, (err, compressed) => {
                    if (!err) compressedBinaryCache = compressed;
                });

                // Tell the sender and broadcast to everyone else instantly
                socket.emit('pixelAccepted', { x, y, color, username, cooldownMs: cooldownMs });
                socket.broadcast.emit('pixelUpdate', { x, y, color, username });
                
                // Background DB update (Write-Through Cache)
                const updateUser = `INSERT INTO users (username, last_placed_time) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET last_placed_time = EXCLUDED.last_placed_time`;
                const updatePixel = `INSERT INTO pixels (x, y, color, username) VALUES ($1, $2, $3, $4) ON CONFLICT (x, y) DO UPDATE SET color = EXCLUDED.color, username = EXCLUDED.username`;
                
                pool.query(updateUser, [username, now])
                    .then(() => pool.query(updatePixel, [x, y, color, username]))
                    .catch(err => console.error("Error saving pixel to DB: " + err.message));
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Broadcast updated player count after a short delay to ensure disconnection is processed
        io.emit('playerCountUpdate', io.engine.clientsCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});