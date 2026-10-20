--[[
    init.lua
    Universal Master Initializer for Atomware (Rivals)
    Connected to AtomProtect Gateway
    Automatically detects platform (Mobile vs PC / Controller) and loads dedicated UI + Modular Feature Engines
]]

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")

-- Unload previous instance if re-executing
if _G.AtomwareUnload and (_G.AtomwareUILoaded or _G.AtomwareFeaturesLoaded) then
    pcall(_G.AtomwareUnload)
end

_G.AtomwareUILoaded = nil
_G.AtomwareFeaturesLoaded = nil
_G.AtomwareEvents = nil
_G.OnToggle = nil
_G.OnSlider = nil
_G.OnDropdown = nil
_G.OnColorPicker = nil
_G.OnKeybind = nil
_G.FireEvent = nil

-- Platform Detection
local IS_MOBILE = UserInputService.TouchEnabled
local targetUIFile = IS_MOBILE and "mobile_ui.lua" or "main_ui.lua"

-- =========================================================================
-- Hybrid Secure Module Loader
-- 1. In-Memory Virtual File System (AtomProtect VFS Bundle)
-- 2. Virtual require hook
-- 3. GitHub Raw Source Fallback with Cache-Busting
-- =========================================================================
local BASE_REPO_URL = _G.AtomwareRepoUrl or "https://raw.githubusercontent.com/revileDev/Protect/main/scripts/rivals/"

local function loadModule(path)
    local cleanName = path:gsub("%.lua$", "")

    -- 1. In-Memory Virtual File System (AtomProtect Bundle)
    if type(__VFS_MODULES) == "table" then
        local loader = __VFS_MODULES[path] or __VFS_MODULES[cleanName]
        if loader then
            local ok, err = pcall(loader)
            if ok then return true end
            warn("[Atomware: Rivals] Failed to execute in-memory module " .. path .. ":", err)
        end
    end

    -- 2. Virtual require hook
    if type(require) == "function" then
        local ok, res = pcall(require, cleanName)
        if ok and res ~= nil then
            return true
        end
    end

    -- 3. GitHub / Remote HTTP Fallback (Primary direct source with live cache-busting)
    local cacheBuster = tostring(os.time()) .. "_" .. tostring(math.random(100000, 999999))
    local okTest, testSource = pcall(function()
        return game:HttpGet(BASE_REPO_URL .. path .. "?v=" .. cacheBuster)
    end)
    if okTest and testSource and #testSource > 0 and not testSource:find("404: Not Found") and not testSource:find("<!DOCTYPE") then
        local compileOk, chunk, compileErr = pcall(loadstring, testSource)
        if compileOk and chunk then
            local runOk, runErr = pcall(chunk)
            if runOk then return true end
            warn("[Atomware: Rivals] Error running module (" .. path .. "):", tostring(runErr))
        else
            warn("[Atomware: Rivals] Error compiling module (" .. path .. "):", tostring(compileErr))
        end
    end

    warn("[Atomware: Rivals] Could not load module: " .. path)
    return false
end

-- 1. Load Shared Configuration & Cleanup Manager
if not loadModule("config.lua") then
    warn("[Atomware: Rivals] Failed to load config.lua; startup aborted.")
    return
end

if not loadModule("cleanup.lua") then
    warn("[Atomware: Rivals] Failed to load cleanup.lua; startup aborted.")
    return
end

-- Define Global Unloader
_G.AtomwareUnload = function()
    local player = Players.LocalPlayer
    local playerGui = player and player:FindFirstChild("PlayerGui")
    local gui = playerGui and (playerGui:FindFirstChild("AtomwareUI") or playerGui:FindFirstChild("AtomwareMobileUI"))
    if _G.AtomwareConfig then
        _G.AtomwareConfig:Unload(gui)
    elseif gui then
        gui:Destroy()
    end
    _G.AtomwareUILoaded = nil
    _G.AtomwareFeaturesLoaded = nil
    _G.AtomwareEvents = nil
    _G.OnToggle = nil
end

-- 2. Load Platform UI (mobile_ui.lua vs main_ui.lua)
if not loadModule(targetUIFile) then
    if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
    return
end

-- 3. Wait for UI hooks to initialize (timeout after 15s)
local uiWaitCount = 0
repeat
    task.wait()
    uiWaitCount = uiWaitCount + 1
    if uiWaitCount > 900 then
        warn("[Atomware: Rivals] UI failed to initialize after 15s — aborting.")
        if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
        return
    end
until _G.AtomwareUILoaded and _G.AtomwareEvents and _G.OnToggle

-- 4. Load Master Features Engine (which loads modules/combat, visuals, world, player)
if not loadModule("features.lua") then
    warn("[Atomware: Rivals] Feature backend failed to load; cleaning up startup.")
    if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
    return
end

-- 5. Verification (timeout after 15s)
local verifyCount = 0
repeat
    task.wait()
    verifyCount = verifyCount + 1
    if verifyCount > 900 then
        warn("[Atomware: Rivals] Features failed to mark loaded after 15s.")
        if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
        break
    end
until _G.AtomwareUILoaded and _G.AtomwareFeaturesLoaded

print("[Atomware: Rivals] Script Suite Fully Initialized & Online!")
