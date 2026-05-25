# PROJECT OVERVIEW: Multiplayer Pixel Canvas (r/place clone)

## Goal
Build a real-time, web-based multiplayer game where users can place colored pixels on a shared grid. The project must be built in distinct, testable phases. 

## Tech Stack
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (No React/Vue to keep the architecture simple and easy to debug).
*   **Backend:** Node.js with Express.
*   **Real-Time Communication:** Socket.io.
*   **Database:** SQLite (local file-based storage for easy setup and persistence).

## Agent Rules & Guidelines
1.  **One Phase at a Time:** Do not implement features from future phases. Wait for user confirmation that the current phase works perfectly before proceeding.
2.  **No Snippets:** Always output the absolute full, complete code for any file you create or modify. Never use placeholders like `// rest of code here`.
3.  **Console Logging:** Add robust `console.log()` statements on both the frontend and backend for every major action (e.g., "User connected", "Pixel placed at X,Y", "Cooldown active") to make debugging easier.

## CORE MECHANICS
*   **The Grid:** A 100x100 playable canvas.
*   **Real-Time:** All connected players must see pixel updates instantly.
*   **Persistence:** The board state must survive a server restart.
*   **Cooldown:** A player can only place one pixel every 5 minutes.