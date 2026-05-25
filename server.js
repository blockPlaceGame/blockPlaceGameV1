const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the current directory
app.use(express.static(__dirname));
// Parse incoming JSON requests for our Login API
app.use(express.json());

// Make cooldown easily configurable via Render Environment Variables (Defaults to 15 seconds)
const COOLDOWN_SECONDS = process.env.COOLDOWN_SECONDS || 15;
const COOLDOWN_MS = COOLDOWN_SECONDS * 1000;

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

            await client.query(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
                last_placed_time BIGINT
            )`);
            console.log("Users table ready.");

            // Safely patch existing databases to include the password column
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current board state to the new user
    pool.query("SELECT x, y, color, username FROM pixels", (err, res) => {
        if (err) {
            console.error("Error fetching board state: " + err.message);
            return;
        }
        socket.emit('initBoard', res.rows);
        console.log(`Sent full board state (${res.rows.length} pixels) to ${socket.id}`);
    });

    // Check if user is on cooldown upon connecting
    socket.on('checkCooldown', (username) => {
        if (!username) return;
        const now = Date.now();

        pool.query(`SELECT last_placed_time FROM users WHERE username = $1`, [username], (err, res) => {
            if (err) return console.error("Error checking user cooldown on connect: " + err.message);
            
            let lastPlaced = res.rows.length > 0 ? res.rows[0].last_placed_time : 0;
            // Parse string to int because Postgres BIGINT returns as string in Node.js
            let timePassed = now - parseInt(lastPlaced);

            if (timePassed < COOLDOWN_MS) {
                const remainingMs = COOLDOWN_MS - timePassed;
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

            if (timePassed < COOLDOWN_MS) {
                // Reject the placement
                const remainingMs = COOLDOWN_MS - timePassed;
                console.log(`User ${username} rejected. Cooldown active for ${remainingMs}ms.`);
                socket.emit('pixelRejected', { remainingMs });
            } else {
                // Accept the placement
                console.log(`Pixel accepted at X:${x}, Y:${y} with color ${color} by ${username}`);
                
                const updateUser = `INSERT INTO users (username, last_placed_time) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET last_placed_time = EXCLUDED.last_placed_time`;
                const updatePixel = `INSERT INTO pixels (x, y, color, username) VALUES ($1, $2, $3, $4) ON CONFLICT (x, y) DO UPDATE SET color = EXCLUDED.color, username = EXCLUDED.username`;
                
                pool.query(updateUser, [username, now])
                    .then(() => pool.query(updatePixel, [x, y, color, username]))
                    .then(() => {
                        // Tell the sender they were accepted, pass the dynamic cooldown, and broadcast to everyone else
                        socket.emit('pixelAccepted', { x, y, color, username, cooldownMs: COOLDOWN_MS });
                        socket.broadcast.emit('pixelUpdate', { x, y, color, username });
                    })
                    .catch(err => console.error("Error saving pixel to DB: " + err.message));
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});