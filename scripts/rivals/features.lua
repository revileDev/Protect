--[[
    features.lua
    Master Feature Orchestrator for Atomware (Rivals)
    Loads and lifecycle-manages submodules: combat, visuals, world, player
]]

local function loadSubmodule(path)
    local cleanName = path:gsub("%.lua$", "")

    -- 1. In-Memory VFS (AtomProtect Bundle)
    if type(__VFS_MODULES) == "table" then
        local loader = __VFS_MODULES[path] or __VFS_MODULES[cleanName] or __VFS_MODULES["modules/" .. path] or __VFS_MODULES["modules/" .. cleanName]
        if loader then
            local ok, res = pcall(loader)
            if ok then return res end
            warn("[Atomware] Failed executing in-memory module: " .. path, res)
        end
    end

    -- 2. Virtual require hook
    if type(require) == "function" then
        local ok, res = pcall(require, path)
        if ok and res ~= nil then return res end
        local ok2, res2 = pcall(require, cleanName)
        if ok2 and res2 ~= nil then return res2 end
        local ok3, res3 = pcall(require, "modules/" .. cleanName)
        if ok3 and res3 ~= nil then return res3 end
    end

    -- 3. Direct GitHub / Web fallback if URL is configured
    local repoUrl = _G.AtomwareRepoUrl or "https://raw.githubusercontent.com/revileDev/Protect/main/scripts/rivals/"
    if type(game.HttpGet) == "function" then
        local cacheBust = tostring(os.time()) .. "_" .. tostring(math.random(1000, 9999))
        local ok, src = pcall(function() return game:HttpGet(repoUrl .. "modules/" .. path .. "?v=" .. cacheBust) end)
        if ok and src and #src > 0 and not src:find("404: Not Found") and not src:find("<!DOCTYPE") then
            local cOk, chunk, cErr = pcall(loadstring, src)
            if cOk and chunk then
                local rOk, res = pcall(chunk)
                if rOk then return res end
                warn("[Atomware] Submodule run error: " .. path, res)
            else
                warn("[Atomware] Submodule compile error: " .. path, cErr)
            end
        end
    end

    warn("[Atomware] Submodule could not be resolved: " .. path)
    return nil
end

-- Load the 4 core feature engines
local Combat = loadSubmodule("combat.lua")
local Visuals = loadSubmodule("visuals.lua")
local World = loadSubmodule("world.lua")
local Player = loadSubmodule("player.lua")

if _G.AtomwareConfig then
    _G.AtomwareConfig:OnUnload(function()
        if Combat and Combat.Unload then pcall(Combat.Unload) end
        if Visuals and Visuals.Unload then pcall(Visuals.Unload) end
        if World and World.Unload then pcall(World.Unload) end
        if Player and Player.Unload then pcall(Player.Unload) end
    end)
end

_G.AtomwareFeaturesLoaded = true
print("[Atomware: Rivals] All Feature Submodules Loaded (Combat, Visuals, World, Player)")

return {
    Combat = Combat,
    Visuals = Visuals,
    World = World,
    Player = Player,
}
