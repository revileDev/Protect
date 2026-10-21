--[[
    Atomware Rivals - features_lite.lua
    Exact Port of Main Working Source (features.lua) Optimized for Mobile Lite
    
    Memory & Stability Profile:
      - Direct port of working combat & visuals math from features.lua
      - Retains 100% of core combat: Silent Aim, Aimbot, Triggerbot, Hitbox Expander
      - Retains essential ESP: 2D Box, Health Bar, Name, Distance, Weapon, Snaplines
      - Retains World & Movement: Fullbright, Clear Fog, Custom FOV, WalkSpeed, Infinite Jump, Bunny Hop, Noclip
      - Bypasses GPU memory-heavy features (Highlights/Chams, Skeletons, 3D character viewport models)
        to prevent iPad Jetsam memory crashes while preserving exact feature functionality.
      - Universal safeDrawing factory with native ScreenGui fallback for mobile executors without Drawing API.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")
local CoreGui = game:GetService("CoreGui")

local LocalPlayer = Players.LocalPlayer
local Camera = Workspace.CurrentCamera or Workspace:WaitForChild("Camera", 10)

Workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
    if Workspace.CurrentCamera then Camera = Workspace.CurrentCamera end
end)

local function getCamera()
    if Camera and Camera.Parent then return Camera end
    Camera = Workspace.CurrentCamera or Workspace:FindFirstChildOfClass("Camera")
    return Camera
end

-- =========================================================================
-- Resource Tracking & Safe Drawing Factory (With Native ScreenGui Fallback)
-- =========================================================================
local function trackConn(conn)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackConnection then
        return _G.AtomwareCleanup:TrackConnection(conn)
    elseif _G.AtomwareConfig and _G.AtomwareConfig.TrackConnection then
        return _G.AtomwareConfig:TrackConnection(conn)
    end
    return conn
end

local function trackInst(inst)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackInstance then
        return _G.AtomwareCleanup:TrackInstance(inst)
    end
    return inst
end

local fallbackRendererGui = nil
local function getFallbackGui()
    if fallbackRendererGui and fallbackRendererGui.Parent then return fallbackRendererGui end
    pcall(function()
        local gethui = gethui or function() return nil end
        local parent = gethui() or CoreGui or (LocalPlayer and LocalPlayer:FindFirstChildOfClass("PlayerGui"))
        if parent then
            local old = parent:FindFirstChild("AtomwareDrawingFallback")
            if old then old:Destroy() end
            local sg = Instance.new("ScreenGui")
            sg.Name = "AtomwareDrawingFallback"
            sg.ResetOnSpawn = false
            sg.DisplayOrder = 999
            sg.Parent = parent
            fallbackRendererGui = sg
            trackInst(sg)
        end
    end)
    return fallbackRendererGui
end

local DrawingLib = Drawing or (type(getgenv) == "function" and getgenv().Drawing)

local function safeDrawing(kind)
    if DrawingLib and type(DrawingLib.new) == "function" then
        local ok, d = pcall(DrawingLib.new, kind)
        if ok and d then
            if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackDrawing then
                _G.AtomwareCleanup:TrackDrawing(d)
            end
            return d
        end
    end

    -- Universal Drawing-compatible ScreenGui proxy (ensures 100% visibility on executors lacking Drawing)
    local sg = getFallbackGui()
    if not sg then
        local dummy = {
            Visible = false, Transparency = 1, Color = Color3.new(1, 1, 1),
            Thickness = 1, Filled = false, Position = Vector2.zero, Size = Vector2.zero,
            From = Vector2.zero, To = Vector2.zero, Radius = 0, NumSides = 0,
            Text = "", Center = false, Outline = false, Font = 2,
        }
        function dummy:Remove() end
        function dummy:Destroy() end
        return dummy
    end

    local proxy = {}
    local inst = nil

    if kind == "Square" then
        local f = Instance.new("Frame")
        f.BorderSizePixel = 0
        f.BackgroundTransparency = 1
        f.Visible = false
        f.Parent = sg
        local stroke = Instance.new("UIStroke")
        stroke.Thickness = 1
        stroke.Color = Color3.new(1, 1, 1)
        stroke.Parent = f
        inst = f

        local filled = false
        proxy = {
            Visible = false,
            Thickness = 1,
            Filled = false,
            Color = Color3.new(1, 1, 1),
            Transparency = 1,
            Position = Vector2.zero,
            Size = Vector2.zero,
        }
        local mt = {
            __newindex = function(_, k, v)
                proxy[k] = v
                if k == "Visible" then f.Visible = v
                elseif k == "Position" then f.Position = UDim2.fromOffset(v.X, v.Y)
                elseif k == "Size" then f.Size = UDim2.fromOffset(v.X, v.Y)
                elseif k == "Color" then
                    stroke.Color = v
                    if filled then f.BackgroundColor3 = v end
                elseif k == "Thickness" then stroke.Thickness = v
                elseif k == "Filled" then
                    filled = v
                    if filled then
                        f.BackgroundTransparency = 0
                        f.BackgroundColor3 = proxy.Color or Color3.new(1, 1, 1)
                        stroke.Enabled = false
                    else
                        f.BackgroundTransparency = 1
                        stroke.Enabled = true
                    end
                elseif k == "Transparency" then
                    f.Transparency = 1 - v
                end
            end,
            __index = proxy,
        }
        setmetatable(proxy, mt)
    elseif kind == "Circle" then
        local f = Instance.new("Frame")
        f.AnchorPoint = Vector2.new(0.5, 0.5)
        f.BorderSizePixel = 0
        f.BackgroundTransparency = 1
        f.Visible = false
        f.Parent = sg
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(1, 0)
        corner.Parent = f
        local stroke = Instance.new("UIStroke")
        stroke.Thickness = 1.5
        stroke.Color = Color3.new(1, 1, 1)
        stroke.Parent = f
        inst = f

        proxy = {
            Visible = false,
            Thickness = 1.5,
            Filled = false,
            Color = Color3.new(1, 1, 1),
            Radius = 0,
            Position = Vector2.zero,
            NumSides = 64,
        }
        local mt = {
            __newindex = function(_, k, v)
                proxy[k] = v
                if k == "Visible" then f.Visible = v
                elseif k == "Position" then f.Position = UDim2.fromOffset(v.X, v.Y)
                elseif k == "Radius" then f.Size = UDim2.fromOffset(v * 2, v * 2)
                elseif k == "Color" then stroke.Color = v
                elseif k == "Thickness" then stroke.Thickness = v
                end
            end,
            __index = proxy,
        }
        setmetatable(proxy, mt)
    elseif kind == "Text" then
        local lbl = Instance.new("TextLabel")
        lbl.BackgroundTransparency = 1
        lbl.Text = ""
        lbl.TextSize = 12
        lbl.Font = Enum.Font.GothamMedium
        lbl.TextColor3 = Color3.new(1, 1, 1)
        lbl.Visible = false
        lbl.Parent = sg
        local stroke = Instance.new("UIStroke")
        stroke.Thickness = 1
        stroke.Color = Color3.new(0, 0, 0)
        stroke.Parent = lbl
        inst = lbl

        proxy = {
            Visible = false,
            Text = "",
            Size = 12,
            Color = Color3.new(1, 1, 1),
            Position = Vector2.zero,
            Center = false,
            Outline = true,
        }
        local mt = {
            __newindex = function(_, k, v)
                proxy[k] = v
                if k == "Visible" then lbl.Visible = v
                elseif k == "Text" then lbl.Text = tostring(v)
                elseif k == "Size" then lbl.TextSize = math.clamp(v, 9, 24)
                elseif k == "Color" then lbl.TextColor3 = v
                elseif k == "Position" then
                    local offX = proxy.Center and -100 or 0
                    lbl.Position = UDim2.fromOffset(v.X + offX, v.Y)
                    lbl.Size = UDim2.fromOffset(200, 16)
                    lbl.TextXAlignment = proxy.Center and Enum.TextXAlignment.Center or Enum.TextXAlignment.Left
                elseif k == "Center" then
                    local offX = v and -100 or 0
                    lbl.Position = UDim2.fromOffset(proxy.Position.X + offX, proxy.Position.Y)
                    lbl.TextXAlignment = v and Enum.TextXAlignment.Center or Enum.TextXAlignment.Left
                elseif k == "Outline" then stroke.Enabled = v
                end
            end,
            __index = proxy,
        }
        setmetatable(proxy, mt)
    elseif kind == "Line" then
        local line = Instance.new("Frame")
        line.BorderSizePixel = 0
        line.BackgroundColor3 = Color3.new(1, 1, 1)
        line.Visible = false
        line.Parent = sg
        inst = line

        proxy = {
            Visible = false,
            From = Vector2.zero,
            To = Vector2.zero,
            Color = Color3.new(1, 1, 1),
            Thickness = 1,
            Transparency = 1,
        }
        local function updateLine()
            local from, to = proxy.From, proxy.To
            local dist = (to - from).Magnitude
            local angle = math.atan2(to.Y - from.Y, to.X - from.X)
            line.Size = UDim2.fromOffset(dist, proxy.Thickness or 1)
            line.Position = UDim2.fromOffset((from.X + to.X) / 2, (from.Y + to.Y) / 2)
            line.Rotation = math.deg(angle)
            line.AnchorPoint = Vector2.new(0.5, 0.5)
        end
        local mt = {
            __newindex = function(_, k, v)
                proxy[k] = v
                if k == "Visible" then line.Visible = v
                elseif k == "Color" then line.BackgroundColor3 = v
                elseif k == "Thickness" then line.Size = UDim2.fromOffset(line.Size.X.Offset, v)
                elseif k == "From" or k == "To" then updateLine()
                elseif k == "Transparency" then line.BackgroundTransparency = 1 - v
                end
            end,
            __index = proxy,
        }
        setmetatable(proxy, mt)
    else
        inst = Instance.new("Frame")
        inst.Visible = false
        inst.Parent = sg
        proxy = { Visible = false }
    end

    function proxy:Remove()
        if inst and inst.Parent then pcall(function() inst:Destroy() end) end
    end
    function proxy:Destroy()
        proxy:Remove()
    end

    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackDrawing then
        _G.AtomwareCleanup:TrackDrawing(proxy)
    end
    return proxy
end

-- =========================================================================
-- Shared Game State & Helpers (Ported from features.lua)
-- =========================================================================
local function isAlive(player)
    if not player or player == LocalPlayer then return false end
    local char = player.Character
    if not char then return false end
    local hum = char:FindFirstChildOfClass("Humanoid")
    local root = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso") or char:FindFirstChild("UpperTorso")
    if not hum or not root then return false end
    return hum.Health > 0
end

local function isTeamMate(player)
    if not player or not LocalPlayer then return false end
    if player.Team and LocalPlayer.Team and player.Team == LocalPlayer.Team then return true end
    if player.TeamColor and LocalPlayer.TeamColor and player.TeamColor == LocalPlayer.TeamColor then return true end
    return false
end

local function isVisible(targetPart, origin)
    local cam = getCamera()
    if not cam then return false end
    origin = origin or cam.CFrame.Position
    local ignore = { cam, LocalPlayer.Character }
    local params = RaycastParams.new()
    params.FilterType = Enum.RaycastFilterType.Exclude
    params.FilterDescendantsInstances = ignore
    params.IgnoreWater = true

    local dir = targetPart.Position - origin
    local hit = Workspace:Raycast(origin, dir, params)
    if not hit then return true end
    return hit.Instance:IsDescendantOf(targetPart.Parent)
end

-- =========================================================================
-- 1. COMBAT ENGINE (Silent Aim, Aimbot, Triggerbot, Hitbox Expander)
-- =========================================================================
local CombatState = {
    SilentAimEnabled = false,
    SilentTargetPart = "Head",
    SilentHitChance = 100,
    SilentFOV = 120,
    SilentShowFOV = false,
    SilentFOVColor = Color3.fromRGB(205, 104, 255),
    SilentTeamCheck = false,
    SilentWallCheck = false,

    AimbotEnabled = false,
    AimbotKey = "Always On",
    AimbotTargetPart = "Head",
    AimbotSmoothness = 5,
    AimbotFOV = 150,
    AimbotShowFOV = false,
    AimbotFOVColor = Color3.fromRGB(157, 48, 255),
    AimbotTeamCheck = false,
    AimbotWallCheck = false,
    AimbotActive = false,

    TriggerbotEnabled = false,
    TriggerbotDelay = 50,
    TriggerbotTeamCheck = false,
    TriggerbotHeadshotOnly = false,
    TriggerbotLastShot = 0,

    HitboxExpanderEnabled = false,
    HitboxSize = 6,
    HitboxPart = "Head",
    HitboxTransparency = 0.5,
}

local OriginalPartSizes = {}

local silentCircle = safeDrawing("Circle")
silentCircle.Thickness = 1.5
silentCircle.NumSides = 64
silentCircle.Filled = false
silentCircle.Transparency = 0.7
silentCircle.Visible = false

local aimbotCircle = safeDrawing("Circle")
aimbotCircle.Thickness = 1.5
aimbotCircle.NumSides = 64
aimbotCircle.Filled = false
aimbotCircle.Transparency = 0.7
aimbotCircle.Visible = false

local function getClosestPlayer(maxFov, partName, checkTeam, checkWall)
    local cam = getCamera()
    if not cam then return nil, nil, maxFov end
    local mousePos = UserInputService:GetMouseLocation()
    if (mousePos.X == 0 and mousePos.Y == 0) or UserInputService.TouchEnabled then
        mousePos = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)
    end
    local bestTarget = nil
    local bestPart = nil
    local minDistance = maxFov

    for _, player in ipairs(Players:GetPlayers()) do
        if isAlive(player) then
            if not checkTeam or not isTeamMate(player) then
                local char = player.Character
                local part = nil
                if partName == "Head" then
                    part = char:FindFirstChild("Head")
                elseif partName == "Torso" then
                    part = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("UpperTorso") or char:FindFirstChild("Torso")
                elseif partName == "Closest" then
                    local head = char:FindFirstChild("Head")
                    local torso = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("UpperTorso")
                    if head and torso then
                        local headPos, hOn = cam:WorldToViewportPoint(head.Position)
                        local torsoPos, tOn = cam:WorldToViewportPoint(torso.Position)
                        if hOn and tOn then
                            local dH = (Vector2.new(headPos.X, headPos.Y) - mousePos).Magnitude
                            local dT = (Vector2.new(torsoPos.X, torsoPos.Y) - mousePos).Magnitude
                            part = dH < dT and head or torso
                        else
                            part = head
                        end
                    else
                        part = head or torso
                    end
                else
                    part = char:FindFirstChild("Head") or char:FindFirstChild("HumanoidRootPart")
                end

                if part then
                    local screenPos, onScreen = cam:WorldToViewportPoint(part.Position)
                    if onScreen then
                        local dist = (Vector2.new(screenPos.X, screenPos.Y) - mousePos).Magnitude
                        if dist < minDistance then
                            if not checkWall or isVisible(part, cam.CFrame.Position) then
                                minDistance = dist
                                bestTarget = player
                                bestPart = part
                            end
                        end
                    end
                end
            end
        end
    end

    return bestTarget, bestPart, minDistance
end

-- RenderStepped for Aimbot & FOV Circles
trackConn(RunService.RenderStepped:Connect(function()
    local mousePos = UserInputService:GetMouseLocation()
    local cam = getCamera()
    if (mousePos.X == 0 and mousePos.Y == 0) or UserInputService.TouchEnabled then
        mousePos = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)
    end

    if CombatState.SilentShowFOV and CombatState.SilentAimEnabled then
        silentCircle.Visible = true
        silentCircle.Position = mousePos
        silentCircle.Radius = CombatState.SilentFOV
        silentCircle.Color = CombatState.SilentFOVColor
    else
        silentCircle.Visible = false
    end

    if CombatState.AimbotShowFOV and CombatState.AimbotEnabled then
        aimbotCircle.Visible = true
        aimbotCircle.Position = mousePos
        aimbotCircle.Radius = CombatState.AimbotFOV
        aimbotCircle.Color = CombatState.AimbotFOVColor
    else
        aimbotCircle.Visible = false
    end

    local isAimTriggered = CombatState.AimbotActive or CombatState.AimbotKey == "Always On"
    if CombatState.AimbotEnabled and isAimTriggered and cam then
        local _, targetPart = getClosestPlayer(
            CombatState.AimbotFOV,
            CombatState.AimbotTargetPart,
            CombatState.AimbotTeamCheck,
            CombatState.AimbotWallCheck
        )
        if targetPart then
            local targetPos = targetPart.Position
            local camPos = cam.CFrame.Position
            local targetCFrame = CFrame.new(camPos, targetPos)
            local smooth = math.clamp(1 / math.max(1, CombatState.AimbotSmoothness), 0.05, 1)
            cam.CFrame = cam.CFrame:Lerp(targetCFrame, smooth)
        end
    end
end))

-- Silent Aim Metatable Hook
pcall(function()
    if hookmetamethod then
        local oldNamecall
        oldNamecall = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)
            local method = getnamecallmethod and getnamecallmethod()
            if CombatState.SilentAimEnabled and (method == "Raycast" or method == "FindPartOnRay" or method == "FindPartOnRayWithIgnoreList") then
                local _, targetPart = getClosestPlayer(
                    CombatState.SilentFOV,
                    CombatState.SilentTargetPart,
                    CombatState.SilentTeamCheck,
                    CombatState.SilentWallCheck
                )
                if targetPart and (math.random(1, 100) <= CombatState.SilentHitChance) then
                    local args = { ... }
                    if method == "Raycast" and typeof(args[1]) == "Vector3" and typeof(args[2]) == "Vector3" then
                        local origin = args[1]
                        args[2] = (targetPart.Position - origin).Unit * 1000
                        return oldNamecall(self, table.unpack(args))
                    end
                end
            end
            return oldNamecall(self, ...)
        end))
    end
end)

-- Triggerbot Heartbeat
trackConn(RunService.Heartbeat:Connect(function()
    if not CombatState.TriggerbotEnabled then return end
    local now = os.clock() * 1000
    if now - CombatState.TriggerbotLastShot < CombatState.TriggerbotDelay then return end
    local cam = getCamera()
    if not cam then return end

    local mousePos = UserInputService:GetMouseLocation()
    if (mousePos.X == 0 and mousePos.Y == 0) or UserInputService.TouchEnabled then
        mousePos = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)
    end
    local unitRay = cam:ViewportPointToRay(mousePos.X, mousePos.Y)
    local params = RaycastParams.new()
    params.FilterType = Enum.RaycastFilterType.Exclude
    local ignore = { cam }
    if LocalPlayer.Character then table.insert(ignore, LocalPlayer.Character) end
    params.FilterDescendantsInstances = ignore
    params.IgnoreWater = true

    local hit = Workspace:Raycast(unitRay.Origin, unitRay.Direction * 1000, params)
    if hit and hit.Instance then
        local model = hit.Instance:FindFirstAncestorOfClass("Model")
        local player = model and Players:GetPlayerFromCharacter(model)
        if player and isAlive(player) then
            if not CombatState.TriggerbotTeamCheck or not isTeamMate(player) then
                if not CombatState.TriggerbotHeadshotOnly or hit.Instance.Name == "Head" then
                    CombatState.TriggerbotLastShot = now
                    if mouse1click then
                        mouse1click()
                    end
                end
            end
        end
    end
end))

-- Hitbox Expander
local function restoreHitboxes()
    for part, data in pairs(OriginalPartSizes) do
        if part and part.Parent then
            part.Size = data.Size
            part.CanCollide = data.CanCollide
            part.Transparency = data.Transparency
        end
    end
    table.clear(OriginalPartSizes)
end

trackConn(RunService.Heartbeat:Connect(function()
    if not CombatState.HitboxExpanderEnabled then return end
    for _, player in ipairs(Players:GetPlayers()) do
        if isAlive(player) and not (CombatState.SilentTeamCheck and isTeamMate(player)) then
            local char = player.Character
            local part = char and (char:FindFirstChild(CombatState.HitboxPart) or char:FindFirstChild("Head") or char:FindFirstChild("HumanoidRootPart"))
            if part and part:IsA("BasePart") then
                if not OriginalPartSizes[part] then
                    OriginalPartSizes[part] = { Size = part.Size, CanCollide = part.CanCollide, Transparency = part.Transparency }
                end
                local sz = CombatState.HitboxSize
                part.Size = Vector3.new(sz, sz, sz)
                part.CanCollide = false
                part.Transparency = CombatState.HitboxTransparency
            end
        end
    end
end))

-- Keybind input listener for Aimbot (Supports Mouse, Keyboard, and Touch)
local function isInputMatching(input, bindName)
    if not bindName or bindName == "None" then return false end
    if bindName == "Always On" then return true end
    if (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) and bindName == "MouseButton1" then return true end
    if input.UserInputType == Enum.UserInputType.MouseButton2 and bindName == "MouseButton2" then return true end
    if input.UserInputType == Enum.UserInputType.Keyboard and input.KeyCode.Name == bindName then return true end
    return false
end

trackConn(UserInputService.InputBegan:Connect(function(input, gpe)
    if gpe then return end
    if isInputMatching(input, CombatState.AimbotKey) then
        CombatState.AimbotActive = true
    end
end))

trackConn(UserInputService.InputEnded:Connect(function(input)
    if isInputMatching(input, CombatState.AimbotKey) then
        CombatState.AimbotActive = false
    end
end))

-- =========================================================================
-- 2. VISUALS & ESP ENGINE (Exact features.lua Port, Zero GPU Chams)
-- =========================================================================
local VisualsState = {
    Enabled = false,
    Box = false,
    HealthBar = false,
    Name = false,
    Distance = false,
    Weapon = false,
    Snaplines = false,
    TeamCheck = false,
    MaxDistance = 1500,

    BoxColor = Color3.fromRGB(255, 255, 255),
    TextColor = Color3.fromRGB(245, 241, 255),
    SnaplineColor = Color3.fromRGB(205, 104, 255),
    SnaplineOrigin = "Bottom",
}

local ESPCache = {}

local function createPlayerESP(player)
    local esp = {
        BoxOutline = safeDrawing("Square"),
        Box = safeDrawing("Square"),
        HealthBarBg = safeDrawing("Square"),
        HealthBar = safeDrawing("Square"),
        Name = safeDrawing("Text"),
        Distance = safeDrawing("Text"),
        Weapon = safeDrawing("Text"),
        Snapline = safeDrawing("Line"),
    }

    esp.BoxOutline.Thickness = 3
    esp.BoxOutline.Filled = false
    esp.BoxOutline.Color = Color3.fromRGB(0, 0, 0)
    esp.BoxOutline.Visible = false

    esp.Box.Thickness = 1
    esp.Box.Filled = false
    esp.Box.Visible = false

    esp.HealthBarBg.Thickness = 1
    esp.HealthBarBg.Filled = true
    esp.HealthBarBg.Color = Color3.fromRGB(15, 10, 20)
    esp.HealthBarBg.Visible = false

    esp.HealthBar.Thickness = 1
    esp.HealthBar.Filled = true
    esp.HealthBar.Visible = false

    esp.Name.Center = true
    esp.Name.Outline = true
    esp.Name.Size = 12
    esp.Name.Font = 2
    esp.Name.Visible = false

    esp.Distance.Center = true
    esp.Distance.Outline = true
    esp.Distance.Size = 11
    esp.Distance.Font = 2
    esp.Distance.Visible = false

    esp.Weapon.Center = true
    esp.Weapon.Outline = true
    esp.Weapon.Size = 11
    esp.Weapon.Font = 2
    esp.Weapon.Visible = false

    esp.Snapline.Thickness = 1
    esp.Snapline.Visible = false

    ESPCache[player] = esp
    return esp
end

local function hideAllESP(esp)
    esp.BoxOutline.Visible = false
    esp.Box.Visible = false
    esp.HealthBarBg.Visible = false
    esp.HealthBar.Visible = false
    esp.Name.Visible = false
    esp.Distance.Visible = false
    esp.Weapon.Visible = false
    esp.Snapline.Visible = false
end

local function removePlayerESP(player)
    local esp = ESPCache[player]
    if esp then
        hideAllESP(esp)
        ESPCache[player] = nil
    end
end

trackConn(Players.PlayerRemoving:Connect(removePlayerESP))

trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()
    if not cam then return end

    if not VisualsState.Enabled then
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        return
    end

    local vp = cam.ViewportSize

    for _, player in ipairs(Players:GetPlayers()) do
        local esp = ESPCache[player] or createPlayerESP(player)

        if not isAlive(player) or (VisualsState.TeamCheck and isTeamMate(player)) then
            hideAllESP(esp)
            continue
        end

        local char = player.Character
        local root = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso") or char:FindFirstChild("UpperTorso")
        local head = char:FindFirstChild("Head")
        local hum = char:FindFirstChildOfClass("Humanoid")

        if not root or not head or not hum then
            hideAllESP(esp)
            continue
        end

        local dist = (root.Position - cam.CFrame.Position).Magnitude
        if dist > VisualsState.MaxDistance then
            hideAllESP(esp)
            continue
        end

        local rootPos, onScreen = cam:WorldToViewportPoint(root.Position)
        local headPos = cam:WorldToViewportPoint(head.Position + Vector3.new(0, 0.5, 0))
        local legPos = cam:WorldToViewportPoint(root.Position - Vector3.new(0, 3, 0))

        if onScreen then
            local height = math.abs(headPos.Y - legPos.Y)
            local width = height * 0.6
            local boxX = rootPos.X - width / 2
            local boxY = headPos.Y

            if VisualsState.Box then
                esp.BoxOutline.Visible = true
                esp.BoxOutline.Position = Vector2.new(boxX, boxY)
                esp.BoxOutline.Size = Vector2.new(width, height)

                esp.Box.Visible = true
                esp.Box.Position = Vector2.new(boxX, boxY)
                esp.Box.Size = Vector2.new(width, height)
                esp.Box.Color = VisualsState.BoxColor
            else
                esp.BoxOutline.Visible = false
                esp.Box.Visible = false
            end

            if VisualsState.HealthBar then
                local maxHp = math.max(1, hum.MaxHealth)
                local hp = math.clamp(hum.Health, 0, maxHp)
                local hpPct = hp / maxHp
                local barW = 3
                local barH = height * hpPct
                local barX = boxX - barW - 4

                esp.HealthBarBg.Visible = true
                esp.HealthBarBg.Position = Vector2.new(barX, boxY)
                esp.HealthBarBg.Size = Vector2.new(barW, height)

                esp.HealthBar.Visible = true
                esp.HealthBar.Position = Vector2.new(barX, boxY + (height - barH))
                esp.HealthBar.Size = Vector2.new(barW, barH)
                esp.HealthBar.Color = Color3.fromRGB(math.floor(255 * (1 - hpPct)), math.floor(255 * hpPct), 40)
            else
                esp.HealthBarBg.Visible = false
                esp.HealthBar.Visible = false
            end

            if VisualsState.Name then
                esp.Name.Visible = true
                esp.Name.Text = player.DisplayName or player.Name
                esp.Name.Position = Vector2.new(rootPos.X, boxY - 14)
                esp.Name.Color = VisualsState.TextColor
            else
                esp.Name.Visible = false
            end

            if VisualsState.Distance then
                esp.Distance.Visible = true
                esp.Distance.Text = tostring(math.floor(dist * 0.28)) .. "m"
                esp.Distance.Position = Vector2.new(rootPos.X, boxY + height + 2)
                esp.Distance.Color = VisualsState.TextColor
            else
                esp.Distance.Visible = false
            end

            if VisualsState.Weapon then
                local tool = char:FindFirstChildOfClass("Tool")
                esp.Weapon.Visible = tool ~= nil
                if tool then
                    esp.Weapon.Text = "[" .. tool.Name .. "]"
                    local offset = VisualsState.Distance and 16 or 2
                    esp.Weapon.Position = Vector2.new(rootPos.X, boxY + height + offset)
                    esp.Weapon.Color = VisualsState.TextColor
                end
            else
                esp.Weapon.Visible = false
            end

            if VisualsState.Snaplines then
                local originY = vp.Y
                if VisualsState.SnaplineOrigin == "Center" then originY = vp.Y / 2
                elseif VisualsState.SnaplineOrigin == "Top" then originY = 0 end
                esp.Snapline.Visible = true
                esp.Snapline.From = Vector2.new(vp.X / 2, originY)
                esp.Snapline.To = Vector2.new(rootPos.X, legPos.Y)
                esp.Snapline.Color = VisualsState.SnaplineColor
            else
                esp.Snapline.Visible = false
            end
        else
            hideAllESP(esp)
        end
    end
end))

-- =========================================================================
-- 3. WORLD & CAMERA ENGINE (Exact Port)
-- =========================================================================
local OriginalLighting = {
    Ambient = Lighting.Ambient,
    OutdoorAmbient = Lighting.OutdoorAmbient,
    Brightness = Lighting.Brightness,
    FogEnd = Lighting.FogEnd,
    FogStart = Lighting.FogStart,
}
local OriginalCameraFOV = (Camera and Camera.FieldOfView) or 70

local WorldState = {
    Fullbright = false,
    Brightness = 3,
    ClearFog = false,
    CustomFOV = false,
    TargetFOV = 90,
}

trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()

    if WorldState.Fullbright then
        Lighting.Ambient = Color3.fromRGB(255, 255, 255)
        Lighting.OutdoorAmbient = Color3.fromRGB(255, 255, 255)
        Lighting.Brightness = WorldState.Brightness
    end

    if WorldState.ClearFog then
        Lighting.FogEnd = 9e9
        Lighting.FogStart = 9e9
        local atmo = Lighting:FindFirstChildOfClass("Atmosphere")
        if atmo then atmo.Density = 0 end
    end

    if WorldState.CustomFOV and cam then
        cam.FieldOfView = WorldState.TargetFOV
    end
end))

-- =========================================================================
-- 4. PLAYER & MOVEMENT ENGINE (Exact Port)
-- =========================================================================
local PlayerState = {
    SpeedEnabled = false,
    WalkSpeed = 24,
    InfiniteJump = false,
    BunnyHop = false,
    Noclip = false,
}

trackConn(RunService.RenderStepped:Connect(function()
    local char = LocalPlayer.Character
    if char then
        local hum = char:FindFirstChildOfClass("Humanoid")
        local root = char:FindFirstChild("HumanoidRootPart")

        if PlayerState.SpeedEnabled and hum then
            hum.WalkSpeed = PlayerState.WalkSpeed
        end

        if PlayerState.BunnyHop and hum and root then
            if hum.MoveDirection.Magnitude > 0 and hum.FloorMaterial ~= Enum.Material.Air then
                hum:ChangeState(Enum.HumanoidStateType.Jumping)
            end
        end
    end
end))

trackConn(RunService.Stepped:Connect(function()
    if not PlayerState.Noclip then return end
    local char = LocalPlayer.Character
    if not char then return end
    for _, part in ipairs(char:GetDescendants()) do
        if part:IsA("BasePart") and part.CanCollide then
            part.CanCollide = false
        end
    end
end))

trackConn(UserInputService.JumpRequest:Connect(function()
    if PlayerState.InfiniteJump and LocalPlayer.Character then
        local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
        if hum then hum:ChangeState(Enum.HumanoidStateType.Jumping) end
    end
end))

-- =========================================================================
-- 5. EVENT BINDINGS (CONNECTED TO ATOMWARE UI)
-- =========================================================================
if _G.OnToggle then
    -- Combat
    _G.OnToggle("Enable Silent Aim", function(v) CombatState.SilentAimEnabled = v end)
    _G.OnToggle("Show Silent FOV Circle", function(v) CombatState.SilentShowFOV = v end)
    _G.OnToggle("Silent Team Check", function(v) CombatState.SilentTeamCheck = v end)
    _G.OnToggle("Silent Wall Check", function(v) CombatState.SilentWallCheck = v end)
    _G.OnToggle("Enable Aimbot", function(v) CombatState.AimbotEnabled = v end)
    _G.OnToggle("Show Aimbot FOV Circle", function(v) CombatState.AimbotShowFOV = v end)
    _G.OnToggle("Aimbot Team Check", function(v) CombatState.AimbotTeamCheck = v end)
    _G.OnToggle("Aimbot Wall Check", function(v) CombatState.AimbotWallCheck = v end)
    _G.OnToggle("Enable Triggerbot", function(v) CombatState.TriggerbotEnabled = v end)
    _G.OnToggle("Triggerbot Team Check", function(v) CombatState.TriggerbotTeamCheck = v end)
    _G.OnToggle("Triggerbot Headshot Only", function(v) CombatState.TriggerbotHeadshotOnly = v end)
    _G.OnToggle("Enable Hitbox Expander", function(v)
        CombatState.HitboxExpanderEnabled = v
        if not v then restoreHitboxes() end
    end)

    -- Visuals
    _G.OnToggle("Enable ESP", function(v) VisualsState.Enabled = v end)
    _G.OnToggle("Box ESP", function(v) VisualsState.Box = v end)
    _G.OnToggle("Health Bar", function(v) VisualsState.HealthBar = v end)
    _G.OnToggle("Name ESP", function(v) VisualsState.Name = v end)
    _G.OnToggle("Distance ESP", function(v) VisualsState.Distance = v end)
    _G.OnToggle("Weapon ESP", function(v) VisualsState.Weapon = v end)
    _G.OnToggle("Snaplines", function(v) VisualsState.Snaplines = v end)
    _G.OnToggle("Team Check", function(v) VisualsState.TeamCheck = v end)

    -- World
    _G.OnToggle("Fullbright", function(v)
        WorldState.Fullbright = v
        if not v then
            Lighting.Ambient = OriginalLighting.Ambient
            Lighting.OutdoorAmbient = OriginalLighting.OutdoorAmbient
            Lighting.Brightness = OriginalLighting.Brightness
        end
    end)
    _G.OnToggle("Clear Atmosphere / Fog", function(v)
        WorldState.ClearFog = v
        if not v then
            Lighting.FogEnd = OriginalLighting.FogEnd
            Lighting.FogStart = OriginalLighting.FogStart
        end
    end)
    _G.OnToggle("Custom Camera FOV", function(v)
        WorldState.CustomFOV = v
        if not v and Camera then Camera.FieldOfView = OriginalCameraFOV end
    end)

    -- Player
    _G.OnToggle("Speed Multiplier", function(v)
        PlayerState.SpeedEnabled = v
        if not v and LocalPlayer.Character then
            local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end
        end
    end)
    _G.OnToggle("Infinite Jump", function(v) PlayerState.InfiniteJump = v end)
    _G.OnToggle("Bunny Hop", function(v) PlayerState.BunnyHop = v end)
    _G.OnToggle("Noclip", function(v) PlayerState.Noclip = v end)
end

if _G.OnSlider then
    _G.OnSlider("Silent Aim Hit Chance", function(v) CombatState.SilentHitChance = v end)
    _G.OnSlider("Silent Aim FOV", function(v) CombatState.SilentFOV = v end)
    _G.OnSlider("Aimbot Smoothness", function(v) CombatState.AimbotSmoothness = v end)
    _G.OnSlider("Aimbot FOV", function(v) CombatState.AimbotFOV = v end)
    _G.OnSlider("Triggerbot Delay", function(v) CombatState.TriggerbotDelay = v end)
    _G.OnSlider("Hitbox Size", function(v) CombatState.HitboxSize = v end)
    _G.OnSlider("Hitbox Transparency", function(v) CombatState.HitboxTransparency = v / 100 end)

    _G.OnSlider("Max ESP Distance", function(v) VisualsState.MaxDistance = v end)
    _G.OnSlider("Brightness", function(v) WorldState.Brightness = v end)
    _G.OnSlider("Camera FOV", function(v) WorldState.TargetFOV = v end)
    _G.OnSlider("WalkSpeed", function(v) PlayerState.WalkSpeed = v end)
end

if _G.OnDropdown then
    _G.OnDropdown("Silent Target Part", function(v) CombatState.SilentTargetPart = v end)
    _G.OnDropdown("Aimbot Target Part", function(v) CombatState.AimbotTargetPart = v end)
    _G.OnDropdown("Aimbot Mode", function(v) CombatState.AimbotKey = v end)
    _G.OnDropdown("Hitbox Part", function(v)
        restoreHitboxes()
        CombatState.HitboxPart = v
    end)
    _G.OnDropdown("Snapline Origin", function(v) VisualsState.SnaplineOrigin = v end)
end

if _G.OnColorPicker then
    _G.OnColorPicker("Silent FOV Color", function(v) CombatState.SilentFOVColor = v end)
    _G.OnColorPicker("Aimbot FOV Color", function(v) CombatState.AimbotFOVColor = v end)
    _G.OnColorPicker("Box Color", function(v) VisualsState.BoxColor = v end)
    _G.OnColorPicker("Text Color", function(v) VisualsState.TextColor = v end)
    _G.OnColorPicker("Snapline Color", function(v) VisualsState.SnaplineColor = v end)
end

if _G.OnKeybind then
    _G.OnKeybind("Aimbot Key", function(v) CombatState.AimbotKey = v end)
end

-- Drain any pending events that fired before features loaded
if type(_G.AtomwarePendingEvents) == "table" and type(_G.AtomwareEvents) == "table" then
    for name, args in pairs(_G.AtomwarePendingEvents) do
        local handler = _G.AtomwareEvents[name]
        if handler then
            pcall(handler, table.unpack(args, 1, args.n or #args))
            _G.AtomwarePendingEvents[name] = nil
        end
    end
end

-- =========================================================================
-- Periodic Garbage Collection Step (Memory Preserver)
-- =========================================================================
task.spawn(function()
    while task.wait(20) do
        pcall(function()
            collectgarbage("step", 150)
        end)
    end
end)

-- =========================================================================
-- Unload Cleanup Hook
-- =========================================================================
if _G.AtomwareConfig then
    _G.AtomwareConfig:OnUnload(function()
        restoreHitboxes()
        silentCircle.Visible = false
        aimbotCircle.Visible = false
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        table.clear(ESPCache)

        Lighting.Ambient = OriginalLighting.Ambient
        Lighting.OutdoorAmbient = OriginalLighting.OutdoorAmbient
        Lighting.Brightness = OriginalLighting.Brightness
        Lighting.FogEnd = OriginalLighting.FogEnd
        Lighting.FogStart = OriginalLighting.FogStart
        if Camera then Camera.FieldOfView = OriginalCameraFOV end

        if LocalPlayer.Character then
            local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end
        end
    end)
end

_G.AtomwareFeaturesLoaded = true
_G.AtomwareLiteMode = true
print("[Atomware Rivals] Mobile_Lite Features Backend Online (Exact Main Source Port Active)!")
return true
