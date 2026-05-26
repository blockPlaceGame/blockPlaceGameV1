document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing Auth System");

    // Auth UI Setup
    const loginOverlay = document.getElementById("login-overlay");
    const mainApp = document.getElementById("main-app");
    const loginBtn = document.getElementById("login-btn");
    const registerBtn = document.getElementById("register-btn");
    const usernameInput = document.getElementById("username-input");
    const passwordInput = document.getElementById("password-input");
    const loginError = document.getElementById("login-error");

    let username = localStorage.getItem("rplace_username");
    if (username) {
        usernameInput.value = username;
    }

    async function handleAuth(action) {
        const user = usernameInput.value.trim();
        const pass = passwordInput.value.trim();
        
        if (!user || !pass) return showError("Username and password required");
        
        try {
            const response = await fetch(`/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            
            const data = await response.json();
            if (response.ok) {
                username = user;
                localStorage.setItem("rplace_username", username);
                loginOverlay.classList.add("hidden");
                mainApp.classList.remove("hidden");
                initApp(); // Launch the game!
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError("Could not connect to server");
        }
    }

    function showError(msg) {
        loginError.innerText = msg;
        loginError.classList.remove("hidden");
    }

    loginBtn.addEventListener("click", () => handleAuth('login'));
    registerBtn.addEventListener("click", () => handleAuth('register'));

    // This function starts the actual game logic AFTER successful login
    function initApp() {
        console.log(`Logged in and starting game as: ${username}`);
        
        // Initialize Socket.io connection
        const socket = io();

    socket.on('cooldownStatus', (data) => {
        console.log(`Resuming cooldown: ${data.remainingMs}ms remaining.`);
        startCooldown(data.remainingMs);
    });

    const canvas = document.getElementById("board");
    const ctx = canvas.getContext("2d");
    const paletteContainer = document.getElementById("palette");
    const timerUI = document.getElementById("cooldown-timer");
    const playerCountUI = document.getElementById("player-count");
    const tooltip = document.getElementById("tooltip");
    const toggleGridBtn = document.getElementById("toggle-grid-btn");
    const gridOverlay = document.getElementById("grid-overlay");

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
        "bedrock": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/bedrock.png",
        "white_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/white_concrete.png",
        "orange_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/orange_concrete.png",
        "magenta_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/magenta_concrete.png",
        "light_blue_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/light_blue_concrete.png",
        "yellow_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/yellow_concrete.png",
        "lime_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/lime_concrete.png",
        "pink_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/pink_concrete.png",
        "gray_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/gray_concrete.png",
        "light_gray_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/light_gray_concrete.png",
        "cyan_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/cyan_concrete.png",
        "purple_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/purple_concrete.png",
        "blue_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/blue_concrete.png",
        "brown_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/brown_concrete.png",
        "green_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/green_concrete.png",
        "red_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/red_concrete.png",
        "black_concrete": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/black_concrete.png",
        "acacia_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/acacia_planks.png",
        "birch_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/birch_planks.png",
        "jungle_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/jungle_planks.png",
        "spruce_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/spruce_planks.png",
        "dark_oak_planks": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/dark_oak_planks.png",
        "andesite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/andesite.png",
        "diorite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/diorite.png",
        "granite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/granite.png",
        "polished_andesite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/polished_andesite.png",
        "polished_diorite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/polished_diorite.png",
        "polished_granite": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/polished_granite.png",
        "clay": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/clay.png",
        "snow": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/snow.png",
        "packed_ice": "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.16.5/assets/minecraft/textures/block/packed_ice.png"
    };

    // Reverse mapping for decoding binary block IDs back into names
    const blockIdsReverse = {
        1: "dirt", 2: "cobblestone", 3: "oak_planks", 4: "stone", 5: "sand", 6: "gravel", 7: "oak_log", 8: "oak_leaves", 9: "glass", 10: "bricks", 11: "obsidian", 12: "netherrack", 13: "soul_sand", 14: "glowstone", 15: "white_wool", 16: "diamond_block", 17: "orange_wool", 18: "magenta_wool", 19: "light_blue_wool", 20: "yellow_wool", 21: "lime_wool", 22: "pink_wool", 23: "gray_wool", 24: "light_gray_wool", 25: "cyan_wool", 26: "purple_wool", 27: "blue_wool", 28: "brown_wool", 29: "green_wool", 30: "red_wool", 31: "black_wool", 32: "gold_block", 33: "iron_block", 34: "emerald_block", 35: "redstone_block", 36: "lapis_block", 37: "coal_block", 38: "bookshelf", 39: "sponge", 40: "bedrock", 41: "white_concrete", 42: "orange_concrete", 43: "magenta_concrete", 44: "light_blue_concrete", 45: "yellow_concrete", 46: "lime_concrete", 47: "pink_concrete", 48: "gray_concrete", 49: "light_gray_concrete", 50: "cyan_concrete", 51: "purple_concrete", 52: "blue_concrete", 53: "brown_concrete", 54: "green_concrete", 55: "red_concrete", 56: "black_concrete", 57: "acacia_planks", 58: "birch_planks", 59: "jungle_planks", 60: "spruce_planks", 61: "dark_oak_planks", 62: "andesite", 63: "diorite", 64: "granite", 65: "polished_andesite", 66: "polished_diorite", 67: "polished_granite", 68: "clay", 69: "snow", 70: "packed_ice"
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

    // Toggle Grid functionality
    toggleGridBtn.addEventListener("click", () => {
        gridOverlay.classList.toggle("hidden");
    });

    // Map Navigation (Pan & Zoom)
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    let scale = 1;
    let panX = 50;
    let panY = 50;
    let isPanning = false;
    let startMouseX = 0, startMouseY = 0;
    let startPanX = 0, startPanY = 0;

    function updateTransform() {
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        gridOverlay.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
    updateTransform();

    // Disable default right-click menu in the wrapper
    canvasWrapper.addEventListener('contextmenu', e => e.preventDefault());

    // Start Panning
    canvasWrapper.addEventListener('mousedown', e => {
        if (e.button === 2) { // Right Click
            isPanning = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            canvas.style.cursor = 'grabbing';
        }
    });

    // Process Panning
    window.addEventListener('mousemove', e => {
        if (isPanning) {
            panX = startPanX + (e.clientX - startMouseX);
            panY = startPanY + (e.clientY - startMouseY);
            updateTransform();
        }
    });

    // Stop Panning
    window.addEventListener('mouseup', e => {
        if (e.button === 2) {
            isPanning = false;
            canvas.style.cursor = 'crosshair';
        }
    });

    // Process Zooming
    canvasWrapper.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY < 0 ? 1 : -1; // Scroll up = zoom in
        
        const rect = canvasWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate current unscaled canvas coordinates of mouse
        const canvasX = (mouseX - panX) / scale;
        const canvasY = (mouseY - panY) / scale;

        // Apply new zoom factor
        const zoomFactor = 1 + delta * zoomIntensity;
        scale = Math.max(0.1, Math.min(scale * zoomFactor, 20)); // Limit scale from 0.1x to 20x

        // Adjust pan to keep the mouse anchored to the exact same block while zooming
        panX = mouseX - canvasX * scale;
        panY = mouseY - canvasY * scale;

        updateTransform();
    }, { passive: false });

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

    let gridWidth = 100;
    let gridHeight = 100;

    // Listen for database configuration before rendering
    socket.on('initConfig', (config) => {
        gridWidth = config.width;
        gridHeight = config.height;
        canvas.width = gridWidth * 16;
        canvas.height = gridHeight * 16;
        gridOverlay.style.width = `${gridWidth * 16}px`;
        gridOverlay.style.height = `${gridHeight * 16}px`;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // Listen for live player count
    socket.on('playerCountUpdate', (count) => {
        if (playerCountUI) playerCountUI.innerText = count;
    });

    // Listen for initial board state from the server
    socket.on('initBoard', (buffer) => {
        console.log(`Received initial board state as binary: ${buffer.byteLength} bytes.`);
        const dataView = new DataView(buffer);
        let offset = 0;

        while (offset < buffer.byteLength) {
            const x = dataView.getUint16(offset, true); offset += 2; // true means Little-Endian
            const y = dataView.getUint16(offset, true); offset += 2;
            const blockId = dataView.getUint8(offset); offset += 1;
            const userLen = dataView.getUint8(offset); offset += 1;

            const userBytes = new Uint8Array(buffer, offset, userLen);
            const username = new TextDecoder('utf-8').decode(userBytes);
            offset += userLen;

            const color = blockIdsReverse[blockId] || "white_concrete";
            
            drawPixel(x, y, color);
            boardMetadata[`${x},${y}`] = username;
        }
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
        startCooldown(data.cooldownMs || 15000); 
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
        
        // Calculate precise X, Y coordinates, allowing for scaling and panning transforms
        const x = Math.floor((event.clientX - rect.left) / (rect.width / gridWidth));
        const y = Math.floor((event.clientY - rect.top) / (rect.height / gridHeight));

        // Send the pixel data to the server
        console.log(`Requesting to place pixel at X:${x}, Y:${y} with block ${currentBlock}`);
        socket.emit('pixelPlaced', { x: x, y: y, color: currentBlock, username: username });
    });

    // Handle Hover Tooltip
    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / (rect.width / gridWidth));
        const y = Math.floor((event.clientY - rect.top) / (rect.height / gridHeight));
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
    } // <-- Ends the initApp function
});