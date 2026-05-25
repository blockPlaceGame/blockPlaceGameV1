document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing Phase 5: Minecraft Block Textures");

    // Identity setup
    let username = localStorage.getItem("rplace_username");
    if (!username) {
        username = prompt("Welcome to r/place clone! Please enter a username:") || "Anonymous_" + Math.floor(Math.random() * 10000);
        localStorage.setItem("rplace_username", username);
    }
    console.log(`Logged in as: ${username}`);

    // Initialize Socket.io connection
    const socket = io();

    // Check if we are currently on cooldown
    socket.emit('checkCooldown', username);
    socket.on('cooldownStatus', (data) => {
        console.log(`Resuming cooldown: ${data.remainingMs}ms remaining.`);
        startCooldown(data.remainingMs);
    });

    const canvas = document.getElementById("board");
    const ctx = canvas.getContext("2d");
    const paletteContainer = document.getElementById("palette");
    const timerUI = document.getElementById("cooldown-timer");
    const tooltip = document.getElementById("tooltip");

    const boardMetadata = {}; // Store who placed what

    let cooldownActive = false;
    let cooldownInterval = null;

    function startCooldown(remainingMs) {
        cooldownActive = true;
        const endTime = Date.now() + remainingMs;
        
        if (cooldownInterval) clearInterval(cooldownInterval);
        
        cooldownInterval = setInterval(() => {
            const diff = endTime - Date.now();
            if (diff <= 0) {
                clearInterval(cooldownInterval);
                cooldownActive = false;
                timerUI.innerText = "00:00";
                timerUI.style.color = "#fff";
            } else {
                const seconds = Math.ceil(diff / 1000);
                const m = Math.floor(seconds / 60).toString().padStart(2, '0');
                const s = (seconds % 60).toString().padStart(2, '0');
                timerUI.innerText = `${m}:${s}`;
                timerUI.style.color = "#ff4444";
            }
        }, 1000);
    }

    // 16 Minecraft block textures
    const blocks = {
        "dirt": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/dirt.png",
        "cobblestone": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/cobblestone.png",
        "oak_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/oak_planks.png",
        "stone": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/stone.png",
        "sand": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/sand.png",
        "gravel": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/gravel.png",
        "oak_log": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/oak_log.png",
        "oak_leaves": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/oak_leaves.png",
        "glass": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/glass.png",
        "bricks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/bricks.png",
        "obsidian": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/obsidian.png",
        "netherrack": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/netherrack.png",
        "soul_sand": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/soul_sand.png",
        "glowstone": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/glowstone.png",
        "white_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/white_wool.png",
        "diamond_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/diamond_block.png",
        "orange_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/orange_wool.png",
        "magenta_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/magenta_wool.png",
        "light_blue_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/light_blue_wool.png",
        "yellow_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/yellow_wool.png",
        "lime_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/lime_wool.png",
        "pink_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/pink_wool.png",
        "gray_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/gray_wool.png",
        "light_gray_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/light_gray_wool.png",
        "cyan_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/cyan_wool.png",
        "purple_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/purple_wool.png",
        "blue_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/blue_wool.png",
        "brown_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/brown_wool.png",
        "green_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/green_wool.png",
        "red_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/red_wool.png",
        "black_wool": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/black_wool.png",
        "gold_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/gold_block.png",
        "iron_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/iron_block.png",
        "emerald_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/emerald_block.png",
        "redstone_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/redstone_block.png",
        "lapis_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/lapis_block.png",
        "coal_block": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/coal_block.png",
        "bookshelf": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/bookshelf.png",
        "sponge": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/sponge.png",
        "bedrock": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/bedrock.png"
    };

    const blockImages = {};
    for (const [name, url] of Object.entries(blocks)) {
        const img = new Image();
        img.src = url;
        blockImages[name] = img;
    }

    let currentBlock = "dirt";

    function drawPixel(x, y, value) {
        const cellSize = 16;
        if (blockImages[value]) {
            if (blockImages[value].complete) {
                ctx.drawImage(blockImages[value], x * cellSize, y * cellSize, cellSize, cellSize);
            } else {
                blockImages[value].addEventListener('load', () => {
                    ctx.drawImage(blockImages[value], x * cellSize, y * cellSize, cellSize, cellSize);
                });
            }
        } else {
            // Fallback for old hex colors saved in DB from previous phases
            ctx.fillStyle = value;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }

    // Initialize Canvas with white background locally
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    console.log("Canvas initialized with 100x100 grid.");

    // Build Block Palette UI
    Object.keys(blocks).forEach(blockName => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        swatch.style.backgroundImage = `url('${blocks[blockName]}')`;
        
        // Set initial selected visual
        if (blockName === currentBlock) {
            swatch.classList.add("selected");
        }

        swatch.addEventListener("click", () => {
            currentBlock = blockName;
            console.log(`Block selected: ${currentBlock}`);
            
            // Update visuals
            document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
            swatch.classList.add("selected");
        });

        paletteContainer.appendChild(swatch);
    });

    // Listen for initial board state from the server
    socket.on('initBoard', (pixels) => {
        console.log(`Received initial board state with ${pixels.length} pixels.`);
        pixels.forEach(pixel => {
            drawPixel(pixel.x, pixel.y, pixel.color);
            if (pixel.username) {
                boardMetadata[`${pixel.x},${pixel.y}`] = pixel.username;
            }
        });
    });

    // Listen for incoming pixel updates from the server
    socket.on('pixelUpdate', (data) => {
        console.log(`Received pixel update at X:${data.x}, Y:${data.y} with block/color ${data.color}`);
        drawPixel(data.x, data.y, data.color);
        if (data.username) {
            boardMetadata[`${data.x},${data.y}`] = data.username;
        }
    });

    // Handle Server confirming our pixel was placed
    socket.on('pixelAccepted', (data) => {
        console.log(`Server accepted pixel at X:${data.x}, Y:${data.y}`);
        drawPixel(data.x, data.y, data.color);
        if (data.username) {
            boardMetadata[`${data.x},${data.y}`] = data.username;
        }
        startCooldown(15 * 1000); // 15 seconds
    });

    // Handle Server rejecting our pixel
    socket.on('pixelRejected', (data) => {
        console.log(`Server rejected pixel. Cooldown active.`);
        startCooldown(data.remainingMs);
    });

    // Handle Canvas Clicks
    canvas.addEventListener("click", (event) => {
        if (cooldownActive) {
            console.log("Cannot place pixel: Cooldown is active.");
            return;
        }

        const rect = canvas.getBoundingClientRect();
        
        // Calculate precise X, Y coordinates on the 100x100 grid by mapping physical clicks to scaled CSS size
        const x = Math.floor((event.clientX - rect.left) / (rect.width / 100));
        const y = Math.floor((event.clientY - rect.top) / (rect.height / 100));

        // Send the pixel data to the server
        console.log(`Requesting to place pixel at X:${x}, Y:${y} with block ${currentBlock}`);
        socket.emit('pixelPlaced', { x: x, y: y, color: currentBlock, username: username });
    });

    // Handle Hover Tooltip
    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / (rect.width / 100));
        const y = Math.floor((event.clientY - rect.top) / (rect.height / 100));
        const key = `${x},${y}`;

        if (boardMetadata[key]) {
            tooltip.style.display = "block";
            tooltip.style.left = (event.clientX + 15) + "px"; // Offset slightly from mouse cursor
            tooltip.style.top = (event.clientY + 15) + "px";
            tooltip.innerText = `Placed by: ${boardMetadata[key]}`;
        } else {
            tooltip.style.display = "none";
        }
    });

    canvas.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
});