--[[
    Atomware Rivals - init.lua
    Universal Master Initializer for Atomware Rivals
    Connected to TestFork Repository (https://github.com/revileDev/TestFork)
    
    Includes:
      - PlaceId verification guard (Rivals: 17625359962)
      - Mobile Touch vs Desktop PC detection
      - Hardware Memory Advisor: Detects low-memory mobile devices (~3GB RAM or lower)
        and prompts the user to load Mobile_Lite to avoid iOS Jetsam / Android OOM crashes.
      - Hybrid module loader with live cache-busting & in-memory VFS fallback.
]]

local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")
local Stats = game:GetService("Stats")

-- Game Verification Guard (Rivals Place ID: 17625359962)
local SUPPORTED_PLACE_ID = 17625359962

local function checkGameSupported()
    if game.PlaceId == SUPPORTED_PLACE_ID or tostring(game.PlaceId) == "17625359962" or game.GameId == 6035872082 then
        return true
    end

    -- 1. Native StarterGui Notification
    pcall(function()
        game:GetService("StarterGui"):SetCore("SendNotification", {
            Title = "Atomware Rivals",
            Text = "this game is not supported",
            Duration = 6,
        })
    end)

    -- 2. Fallback On-Screen Toast (Reliable on all PC and Mobile executors)
    pcall(function()
        local gethui = gethui or function() return nil end
        local parent = gethui() or game:GetService("CoreGui") or (Players.LocalPlayer and Players.LocalPlayer:FindFirstChildOfClass("PlayerGui"))
        if parent then
            local oldToast = parent:FindFirstChild("Atomware_UnsupportedGame")
            if oldToast then oldToast:Destroy() end

            local sg = Instance.new("ScreenGui")
            sg.Name = "Atomware_UnsupportedGame"
            sg.ResetOnSpawn = false
            sg.DisplayOrder = 9999
            sg.Parent = parent

            local banner = Instance.new("Frame")
            banner.AnchorPoint = Vector2.new(0.5, 0)
            banner.Position = UDim2.new(0.5, 0, 0, 24)
            banner.Size = UDim2.fromOffset(320, 52)
            banner.BackgroundColor3 = Color3.fromRGB(18, 12, 28)
            banner.BorderSizePixel = 0
            banner.Parent = sg

            local corner = Instance.new("UICorner")
            corner.CornerRadius = UDim.new(0, 10)
            corner.Parent = banner

            local stroke = Instance.new("UIStroke")
            stroke.Color = Color3.fromRGB(255, 75, 125)
            stroke.Thickness = 1.5
            stroke.Parent = banner

            local title = Instance.new("TextLabel")
            title.Size = UDim2.new(1, -24, 0, 20)
            title.Position = UDim2.fromOffset(12, 6)
            title.BackgroundTransparency = 1
            title.Text = "ATOMWARE"
            title.TextColor3 = Color3.fromRGB(205, 104, 255)
            title.TextSize = 11
            title.Font = Enum.Font.GothamBold
            title.TextXAlignment = Enum.TextXAlignment.Left
            title.Parent = banner

            local desc = Instance.new("TextLabel")
            desc.Size = UDim2.new(1, -24, 0, 20)
            desc.Position = UDim2.fromOffset(12, 24)
            desc.BackgroundTransparency = 1
            desc.Text = "this game is not supported"
            desc.TextColor3 = Color3.fromRGB(255, 241, 255)
            desc.TextSize = 13
            desc.Font = Enum.Font.GothamBold
            desc.TextXAlignment = Enum.TextXAlignment.Left
            desc.Parent = banner

            task.delay(6, function()
                if sg and sg.Parent then sg:Destroy() end
            end)
        end
    end)

    warn("[Atomware] this game is not supported (Current PlaceId: " .. tostring(game.PlaceId) .. ", Required: " .. tostring(SUPPORTED_PLACE_ID) .. ")")
    return false
end

if not checkGameSupported() then
    return
end

-- If the initializer is run again, unload previous instance first.
if _G.AtomwareUnload and (_G.AtomwareUILoaded or _G.AtomwareFeaturesLoaded) then
    pcall(_G.AtomwareUnload)
end
_G.AtomwareUILoaded = nil
_G.AtomwareFeaturesLoaded = nil
_G.AtomwareLiteMode = nil
_G.AtomwareWindow = nil
_G.AtomwareEvents = nil
_G.OnToggle = nil
_G.OnSlider = nil
_G.OnDropdown = nil
_G.OnColorPicker = nil
_G.OnKeybind = nil

-- =========================================================================
-- Hardware Memory Advisor Modal (Low-Memory Mobile Protection)
-- =========================================================================
local function promptMobileLiteMode(callback)
    local gethui = gethui or function() return nil end
    local parent = gethui() or game:GetService("CoreGui") or (Players.LocalPlayer and Players.LocalPlayer:FindFirstChildOfClass("PlayerGui"))
    if not parent then
        callback("lite")
        return
    end

    local oldPrompt = parent:FindFirstChild("Atomware_LiteModeAdvisor")
    if oldPrompt then oldPrompt:Destroy() end

    local sg = Instance.new("ScreenGui")
    sg.Name = "Atomware_LiteModeAdvisor"
    sg.ResetOnSpawn = false
    sg.DisplayOrder = 10000
    sg.Parent = parent

    -- Background Dimming
    local backdrop = Instance.new("Frame")
    backdrop.Size = UDim2.fromScale(1, 1)
    backdrop.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
    backdrop.BackgroundTransparency = 0.45
    backdrop.BorderSizePixel = 0
    backdrop.Parent = sg

    local modal = Instance.new("Frame")
    modal.AnchorPoint = Vector2.new(0.5, 0.5)
    modal.Position = UDim2.fromScale(0.5, 0.5)
    modal.Size = UDim2.fromOffset(360, 240)
    modal.BackgroundColor3 = Color3.fromRGB(12, 8, 22)
    modal.BorderSizePixel = 0
    modal.Parent = sg

    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, 12)
    c.Parent = modal

    local s = Instance.new("UIStroke")
    s.Color = Color3.fromRGB(157, 48, 255)
    s.Thickness = 1.5
    s.Parent = modal

    local tag = Instance.new("TextLabel")
    tag.Size = UDim2.new(1, -24, 0, 18)
    tag.Position = UDim2.fromOffset(16, 14)
    tag.BackgroundTransparency = 1
    tag.Text = "ATOMWARE HARDWARE ADVISOR"
    tag.TextColor3 = Color3.fromRGB(205, 104, 255)
    tag.TextSize = 10
    tag.Font = Enum.Font.GothamBold
    tag.TextXAlignment = Enum.TextXAlignment.Left
    tag.Parent = modal

    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, -24, 0, 26)
    title.Position = UDim2.fromOffset(16, 32)
    title.BackgroundTransparency = 1
    title.Text = "Low-Memory Device Detected"
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.TextSize = 16
    title.Font = Enum.Font.GothamBold
    title.TextXAlignment = Enum.TextXAlignment.Left
    title.Parent = modal

    local body = Instance.new("TextLabel")
    body.Size = UDim2.new(1, -32, 0, 52)
    body.Position = UDim2.fromOffset(16, 62)
    body.BackgroundTransparency = 1
    body.Text = "Your mobile device has a limited memory budget (~3GB or lower). Running full 3D models, Chams, and cosmetics may cause your game to crash."
    body.TextColor3 = Color3.fromRGB(180, 165, 215)
    body.TextSize = 12
    body.Font = Enum.Font.GothamMedium
    body.TextWrapped = true
    body.TextXAlignment = Enum.TextXAlignment.Left
    body.Parent = modal

    -- Primary: Load Lite Mode
    local liteBtn = Instance.new("TextButton")
    liteBtn.Size = UDim2.new(1, -32, 0, 42)
    liteBtn.Position = UDim2.fromOffset(16, 126)
    liteBtn.BackgroundColor3 = Color3.fromRGB(38, 18, 72)
    liteBtn.Text = "LOAD LITE MODE (RECOMMENDED)"
    liteBtn.TextColor3 = Color3.fromRGB(42, 255, 200)
    liteBtn.TextSize = 12
    liteBtn.Font = Enum.Font.GothamBold
    liteBtn.AutoButtonColor = false
    liteBtn.Parent = modal
    local lc = Instance.new("UICorner")
    lc.CornerRadius = UDim.new(0, 8)
    lc.Parent = liteBtn
    local ls = Instance.new("UIStroke")
    ls.Color = Color3.fromRGB(42, 255, 200)
    ls.Thickness = 1.2
    ls.Parent = liteBtn

    -- Secondary: Load Standard Mode
    local stdBtn = Instance.new("TextButton")
    stdBtn.Size = UDim2.new(1, -32, 0, 36)
    stdBtn.Position = UDim2.fromOffset(16, 178)
    stdBtn.BackgroundColor3 = Color3.fromRGB(20, 14, 34)
    stdBtn.Text = "LOAD STANDARD MODE (RISK OF CRASH)"
    stdBtn.TextColor3 = Color3.fromRGB(150, 135, 175)
    stdBtn.TextSize = 11
    stdBtn.Font = Enum.Font.GothamMedium
    stdBtn.AutoButtonColor = false
    stdBtn.Parent = modal
    local sc = Instance.new("UICorner")
    sc.CornerRadius = UDim.new(0, 8)
    sc.Parent = stdBtn
    local ss = Instance.new("UIStroke")
    ss.Color = Color3.fromRGB(60, 35, 100)
    ss.Thickness = 1
    ss.Parent = stdBtn

    liteBtn.MouseButton1Click:Connect(function()
        sg:Destroy()
        callback("lite")
    end)

    stdBtn.MouseButton1Click:Connect(function()
        sg:Destroy()
        callback("standard")
    end)
end

-- Platform & Profile Selection
local IS_MOBILE = UserInputService.TouchEnabled
local targetUIFile = "main_ui.lua"
local targetFeaturesFile = "features.lua"
local isLiteMode = false

if IS_MOBILE then
    local done = false
    promptMobileLiteMode(function(choice)
        if choice == "lite" then
            isLiteMode = true
            targetUIFile = "mobile_lite_ui.lua"
            targetFeaturesFile = "features.lua"
        else
            isLiteMode = false
            targetUIFile = "mobile_ui.lua"
            targetFeaturesFile = "features.lua"
        end
        done = true
    end)

    while not done do
        task.wait(0.05)
    end
else
    targetUIFile = "main_ui.lua"
    targetFeaturesFile = "features.lua"
end
_G.AtomwareLiteMode = isLiteMode

-- =========================================================================
-- Hybrid Secure Module Loader
-- 1. In-Memory Virtual File System (Instant 0ms execution from auth bundle)
-- 2. Virtual require hook
-- 3. Fallback: Direct TestFork GitHub loader
-- =========================================================================
local function loadModule(path)
    local cleanName = path:gsub("%.lua$", "")
    local baseName = cleanName:match("([^/]+)$") or cleanName

    -- 1. In-Memory Virtual File System (Instant 0ms execution)
    if type(__VFS_MODULES) == "table" then
        local loader = __VFS_MODULES[path]
            or __VFS_MODULES[cleanName]
            or __VFS_MODULES[baseName]
            or __VFS_MODULES[baseName .. ".lua"]
            or __VFS_MODULES["rivals/" .. baseName .. ".lua"]
            or __VFS_MODULES["rivals/" .. baseName]
        if loader then
            local ok, err = pcall(loader)
            if ok then return true end
            warn("[Atomware Rivals] Failed to execute in-memory module " .. path .. ":", err)
        end
    end

    -- 2. Virtual require hook
    if type(require) == "function" then
        local ok, res = pcall(require, cleanName)
        if ok and res ~= nil then
            return true
        end
        local ok2, res2 = pcall(require, baseName)
        if ok2 and res2 ~= nil then
            return true
        end
    end

    -- 3. Fallback: TestFork GitHub Repository
    local TESTFORK_URL = "https://raw.githubusercontent.com/revileDev/TestFork/main/rivals/"
    local cacheBuster = tostring(os.time()) .. "_" .. tostring(math.random(100000, 999999))
    local okTest, testSource = pcall(function()
        return game:HttpGet(TESTFORK_URL .. baseName .. ".lua?v=" .. cacheBuster)
    end)
    if okTest and testSource and #testSource > 0 and not testSource:find("404: Not Found") and not testSource:find("<!DOCTYPE") then
        local compileOk, chunk, compileErr = pcall(loadstring, testSource)
        if compileOk and chunk then
            local runOk, runErr = pcall(chunk)
            if runOk then return true end
            warn("[Atomware Rivals] Error running module from TestFork (" .. path .. "):", runErr)
        else
            warn("[Atomware Rivals] Error compiling module from TestFork (" .. path .. "):", compileErr)
        end
    end

    warn("[Atomware Rivals] Could not load module: " .. path)
    return false
end

-- 1. Load Cleanup Manager & Shared Configuration
if not loadModule("cleanup.lua") then
    warn("[Atomware Rivals] cleanup manager could not be loaded; startup aborted.")
    return
end
if not loadModule("config.lua") then
    warn("[Atomware Rivals] shared configuration could not be loaded; startup aborted.")
    return
end

_G.AtomwareUnload = function()
    local player = Players.LocalPlayer
    local playerGui = player and player:FindFirstChild("PlayerGui")
    local cg = game:GetService("CoreGui")
    local gui = playerGui and (playerGui:FindFirstChild("AtomwareRivalsUI") or playerGui:FindFirstChild("AtomwareMobileRivalsUI") or playerGui:FindFirstChild("AtomwareMobileLiteRivalsUI"))
    if _G.AtomwareConfig then
        _G.AtomwareConfig:Unload(gui)
    elseif gui then
        gui:Destroy()
    end
    pcall(function()
        local cw = (playerGui and playerGui:FindFirstChild("Atomware_ChatroomWidget")) or (cg and cg:FindFirstChild("Atomware_ChatroomWidget"))
        if cw then cw:Destroy() end
        local sw = (playerGui and playerGui:FindFirstChild("Atomware_SearchWidget")) or (cg and cg:FindFirstChild("Atomware_SearchWidget"))
        if sw then sw:Destroy() end
    end)
    _G.AtomwareChatroomLoaded = nil
    _G.AtomwareUILoaded = nil
    _G.AtomwareFeaturesLoaded = nil
    _G.AtomwareLiteMode = nil
    _G.AtomwareWindow = nil
    _G.AtomwareEvents = nil
    _G.OnToggle = nil
end

-- 2. Load Cosmetics Subsystem (Skipped in Lite Mode to save GPU VRAM)
if not isLiteMode then
    if not loadModule("cosmetics.lua") then
        warn("[Atomware Rivals] cosmetics subsystem could not be loaded; continuing.")
    end
else
    print("[Atomware Rivals] Lite Mode: Bypassing cosmetics subsystem to preserve GPU VRAM.")
end

-- 3. Load Platform UI (mobile_lite_ui.lua vs mobile_ui.lua vs main_ui.lua)
if not loadModule(targetUIFile) then
    if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
    return
end

-- 4. Wait for UI hooks to initialize (timeout after 15 s)
local uiWaitCount = 0
repeat
    task.wait()
    uiWaitCount = uiWaitCount + 1
    if uiWaitCount > 900 then
        warn("[Atomware Rivals] UI failed to initialise after 15s — aborting.")
        if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
        return
    end
until _G.AtomwareUILoaded and _G.AtomwareWindow

-- 5. Load Features Backend Engine (features_lite.lua vs features.lua)
if not loadModule(targetFeaturesFile) then
    warn("[Atomware Rivals] features backend could not be loaded; cleaning up startup.")
    if _G.AtomwareUnload then pcall(_G.AtomwareUnload) end
    return
end

-- 6. Verify everything is online (timeout after 15 s)
local verifyCount = 0
repeat
    task.wait()
    verifyCount = verifyCount + 1
    if verifyCount > 900 then
        warn("[Atomware Rivals] Features failed to mark loaded after 15s — check features.lua for errors.")
        break
    end
until _G.AtomwareUILoaded and _G.AtomwareFeaturesLoaded

-- 7. Confirmation Toast & Print
if _G.AtomwareConfig and _G.AtomwareConfig.Notify then
    local modeLabel = isLiteMode and "Mobile Lite (Safe)" or (IS_MOBILE and "Mobile Full" or "PC Full")
    _G.AtomwareConfig:Notify("Atomware Rivals Loaded (" .. modeLabel .. ")", 4)
end
print("[Atomware Rivals] Fully Initialized in " .. (isLiteMode and "Mobile Lite Mode" or "Standard Mode") .. "!")

-- 8. Load Atomware Chatroom Widget (Skipped in Lite Mode to minimize socket/DOM memory overhead)
if not isLiteMode then
    task.spawn(function()
        pcall(function()
            loadModule("chatroom_widget.lua")
        end)
    end)
else
    print("[Atomware Rivals] Lite Mode: Chatroom widget bypassed to minimize memory.")
end
