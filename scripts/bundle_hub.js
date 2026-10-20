const fs = require("fs");
const path = require("path");

const modulesDir = path.join(__dirname, "..", "hub", "modules");

function indent(code, spaces = 4) {
  const pad = " ".repeat(spaces);
  return code
    .split(/\r?\n/)
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\r\n");
}

function readMod(filename) {
  return fs.readFileSync(path.join(modulesDir, filename), "utf8");
}

console.log("Reading modules from:", modulesDir);
const mod1 = readMod("games_database.lua");
const mod2 = readMod("notification.lua");
const mod3 = readMod("telemetry.lua");
const mod4 = readMod("auth_prompt.lua");
const mod5 = readMod("search_widget.lua");
const mod6 = readMod("watermark.lua");
const mod7 = readMod("chatroom_widget.lua");
const mod8 = readMod("orchestrator.lua");

const header = `--[[
======================================================================
     ATOMWARE UNIVERSAL GAME HUB (700+ ROBLOX GAMES SUPPORTED)
======================================================================
  * Key: THEBESTFIXED
  * Discord: https://discord.gg/AeCYnnQmq5
  * Compiled At: ${new Date().toISOString()}
  * Features:
    - Auto Game Detection (700+ Place IDs)
    - Key Auth Prompt Modal with Discord Clipboard Integration
    - Discord Telemetry & Execution Audit Logger
    - Floating Draggable 🔍 Search & Gamehop Engine (Positioned perfectly, non-overlapping)
    - Floating Draggable 💬 Global Chatroom & Dev Direct Messages (With live sync & cooldowns)
    - Developer Reply Notifications & In-game Sound Pings
    - Bottom-Right Live Watermark & Real-Time FPS Monitor
    - Cross-Platform UI (PC & Mobile Touch Responsive)
======================================================================
]]

do
    -- [MODULE 1: Games Database]
    local GamesDatabase = (function()
${indent(mod1, 8)}
    end)()

    -- [MODULE 2: Toast Notification Engine]
    local Notification = (function()
${indent(mod2, 8)}
    end)()

    -- [MODULE 3: Discord Telemetry Logger]
    local Telemetry = (function()
${indent(mod3, 8)}
    end)()

    -- [MODULE 4: Key Authentication Modal]
    local AuthPrompt = (function()
${indent(mod4, 8)}
    end)()

    -- [MODULE 5: Floating Draggable Search & Gamehop Widget]
    local SearchWidget = (function()
${indent(mod5, 8)}
    end)()

    -- [MODULE 6: Persistent Watermark & Live FPS Counter]
    local Watermark = (function()
${indent(mod6, 8)}
    end)()

    -- [MODULE 7: Global Chatroom & Developer Direct Messages]
    local ChatroomWidget = (function()
${indent(mod7, 8)}
    end)()

    -- [MODULE 8: Core Orchestrator]
    local runAtomwareHub = (function()
${indent(mod8, 8)}
    end)()

    -- Initialize and start AtomWare Hub immediately
    runAtomwareHub(GamesDatabase, Notification, Telemetry, AuthPrompt, SearchWidget, Watermark, ChatroomWidget)
end
`;

const outputPath1 = path.join(modulesDir, "init.lua");
const outputPath2 = path.join(__dirname, "..", "hub", "init.lua");
const outputPath3 = path.join(__dirname, "..", "hub", "build", "atomware_hub.bundle.lua");

fs.writeFileSync(outputPath1, header, "utf8");
fs.writeFileSync(outputPath2, header, "utf8");
fs.writeFileSync(outputPath3, header, "utf8");
console.log("Successfully generated bundles at:\n", outputPath1, "\n", outputPath2, "\n", outputPath3, "\nSize:", header.length, "bytes");
