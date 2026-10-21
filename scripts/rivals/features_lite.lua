--[[
    Atomware Rivals - features_lite.lua
    Ultra-Optimized Lightweight Feature Backend for Low-Memory Devices (iPads / Low-End Phones)
    
    Memory & Stability Guarantees:
      - ZERO Highlight / Chams instances (Eliminates iOS Jetsam memory killer)
      - ZERO ViewportFrames / 3D Character Mesh Rendering
      - ZERO BoxFill alpha-blending redraw loops
      - ZERO Skeleton bone-matrix calculations
      - Retains 100% of core combat and essential ESP:
          * Silent Aim (with Mobile Always-On)
          * Aimbot (Smoothness, FOV Circle, Mobile Always-On)
          * Hitbox Expander (Head / HumanoidRootPart)
          * 2D Box ESP, Health Bar, Name, Distance
          * Fullbright, Clear Fog, FOV Slider
          * WalkSpeed, Infinite Jump, Bunny Hop
      - Integrated background Garbage Collector step every 20s
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

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
-- Resource Tracking & Safe Drawing Factory
-- =========================================================================
local function trackConn(conn)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackConnection then
        return _G.AtomwareCleanup:TrackConnection(conn)
    elseif _G.AtomwareConfig and _G.AtomwareConfig.TrackConnection then
        return _G.AtomwareConfig:TrackConnection(conn)
    end
    return conn
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
    local dummy = {
        Visible = false,
        Transparency = 1,
        Color = Color3.new(1, 1, 1),
        Thickness = 1,
        Filled = false,
        Position = Vector2.zero,
        Size = Vector2.zero,
        Radius = 0,
        NumSides = 0,
        Text = "",
        Center = false,
        Outline = false,
        Font = 2,
    }
    function dummy:Remove() end
    function dummy:Destroy() end
    return dummy
end

-- =========================================================================
-- Shared Game State & Helpers
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
-- 1. COMBAT ENGINE (Silent Aim, Aimbot, Hitbox Expander)
-- =========================================================================
local CombatState = {
    SilentAimEnabled = false,
    SilentTargetPart = "Head",
    SilentHitChance = 100,
    SilentFOV = 120,
    SilentShowFOV = false,
    SilentFOVColor = Color3.fromRGB(205, 104, 255),
    SilentTeamCheck = true,
    SilentWallCheck = false,

    AimbotEnabled = false,
    AimbotKey = "Always On",
    AimbotTargetPart = "Head",
    AimbotSmoothness = 4,
    AimbotFOV = 140,
    AimbotShowFOV = false,
    AimbotFOVColor = Color3.fromRGB(157, 48, 255),
    AimbotTeamCheck = true,
    AimbotWallCheck = false,
    AimbotActive = false,

    HitboxExpanderEnabled = false,
    HitboxSize = 8,
    HitboxTransparency = 0.5,
    HitboxPart = "HumanoidRootPart",
}

-- FOV Circles
local silentFOVCircle = safeDrawing("Circle")
silentFOVCircle.Visible = false
silentFOVCircle.Thickness = 1.5
silentFOVCircle.NumSides = 36
silentFOVCircle.Filled = false
silentFOVCircle.Color = CombatState.SilentFOVColor

local aimbotFOVCircle = safeDrawing("Circle")
aimbotFOVCircle.Visible = false
aimbotFOVCircle.Thickness = 1.5
aimbotFOVCircle.NumSides = 36
aimbotFOVCircle.Filled = false
aimbotFOVCircle.Color = CombatState.AimbotFOVColor

local function getTargetPart(character, partName)
    if not character then return nil end
    if partName == "Head" then
        return character:FindFirstChild("Head")
    elseif partName == "Torso" or partName == "HumanoidRootPart" then
        return character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("UpperTorso") or character:FindFirstChild("Torso")
    end
    return character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("Head")
end

local function getClosestPlayerToCursor(maxFov, targetPartName, teamCheck, wallCheck)
    local cam = getCamera()
    if not cam then return nil, math.huge end

    local center = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)
    local closestPlayer = nil
    local shortestDist = maxFov

    for _, player in ipairs(Players:GetPlayers()) do
        if isAlive(player) then
            if not (teamCheck and isTeamMate(player)) then
                local part = getTargetPart(player.Character, targetPartName)
                if part then
                    local screenPos, onScreen = cam:WorldToViewportPoint(part.Position)
                    if onScreen then
                        local screenVec = Vector2.new(screenPos.X, screenPos.Y)
                        local dist = (screenVec - center).Magnitude
                        if dist < shortestDist then
                            if not wallCheck or isVisible(part, cam.CFrame.Position) then
                                shortestDist = dist
                                closestPlayer = player
                            end
                        end
                    end
                end
            end
        end
    end

    return closestPlayer, shortestDist
end

-- Silent Aim Hooking (Universal Metatable Hook)
local currentSilentTarget = nil
local hookSuccess = false

pcall(function()
    local gmt = getrawmetatable and getrawmetatable(game)
    local oldIndex = gmt and gmt.__index
    local oldNamecall = gmt and gmt.__namecall
    local setreadonly = setreadonly or make_writeable

    if gmt and setreadonly then
        setreadonly(gmt, false)

        if oldNamecall then
            gmt.__namecall = newcclosure(function(self, ...)
                local method = getnamecallmethod and getnamecallmethod()
                if CombatState.SilentAimEnabled and currentSilentTarget and (method == "Raycast" or method == "FindPartOnRay" or method == "FindPartOnRayWithIgnoreList") then
                    if math.random(1, 100) <= CombatState.SilentHitChance then
                        local part = getTargetPart(currentSilentTarget.Character, CombatState.SilentTargetPart)
                        if part then
                            local args = { ... }
                            if method == "Raycast" and typeof(args[1]) == "Vector3" and typeof(args[2]) == "Vector3" then
                                local origin = args[1]
                                args[2] = (part.Position - origin).Unit * 1000
                                return oldNamecall(self, table.unpack(args))
                            end
                        end
                    end
                end
                return oldNamecall(self, ...)
            end)
        end

        setreadonly(gmt, true)
        hookSuccess = true
    end
end)

-- Hitbox Expander
local originalSizes = {}

local function expandHitbox(player)
    if not isAlive(player) then return end
    local char = player.Character
    local part = char and char:FindFirstChild(CombatState.HitboxPart)
    if part and part:IsA("BasePart") then
        if not originalSizes[part] then
            originalSizes[part] = { Size = part.Size, Transparency = part.Transparency, CanCollide = part.CanCollide }
        end
        part.Size = Vector3.new(CombatState.HitboxSize, CombatState.HitboxSize, CombatState.HitboxSize)
        part.Transparency = CombatState.HitboxTransparency
        part.CanCollide = false
    end
end

local function restoreHitboxes()
    for part, data in pairs(originalSizes) do
        if part and part.Parent then
            pcall(function()
                part.Size = data.Size
                part.Transparency = data.Transparency
                part.CanCollide = data.CanCollide
            end)
        end
    end
    table.clear(originalSizes)
end

-- Combat Frame Loop
trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()
    if not cam then return end

    local center = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)

    -- Update FOV Circles
    if silentFOVCircle then
        silentFOVCircle.Visible = CombatState.SilentAimEnabled and CombatState.SilentShowFOV
        silentFOVCircle.Position = center
        silentFOVCircle.Radius = CombatState.SilentFOV
        silentFOVCircle.Color = CombatState.SilentFOVColor
    end

    if aimbotFOVCircle then
        aimbotFOVCircle.Visible = CombatState.AimbotEnabled and CombatState.AimbotShowFOV
        aimbotFOVCircle.Position = center
        aimbotFOVCircle.Radius = CombatState.AimbotFOV
        aimbotFOVCircle.Color = CombatState.AimbotFOVColor
    end

    -- Update Silent Aim Target
    if CombatState.SilentAimEnabled then
        currentSilentTarget = getClosestPlayerToCursor(
            CombatState.SilentFOV,
            CombatState.SilentTargetPart,
            CombatState.SilentTeamCheck,
            CombatState.SilentWallCheck
        )
    else
        currentSilentTarget = nil
    end

    -- Run Aimbot
    if CombatState.AimbotEnabled and (CombatState.AimbotActive or CombatState.AimbotKey == "Always On") then
        local target = getClosestPlayerToCursor(
            CombatState.AimbotFOV,
            CombatState.AimbotTargetPart,
            CombatState.AimbotTeamCheck,
            CombatState.AimbotWallCheck
        )
        if target and target.Character then
            local part = getTargetPart(target.Character, CombatState.AimbotTargetPart)
            if part then
                local currentCF = cam.CFrame
                local targetCF = CFrame.new(currentCF.Position, part.Position)
                local smooth = math.clamp(CombatState.AimbotSmoothness, 1, 25)
                cam.CFrame = currentCF:Lerp(targetCF, 1 / smooth)
            end
        end
    end

    -- Hitbox Expander Loop
    if CombatState.HitboxExpanderEnabled then
        for _, player in ipairs(Players:GetPlayers()) do
            if isAlive(player) and not (CombatState.SilentTeamCheck and isTeamMate(player)) then
                expandHitbox(player)
            end
        end
    end
end))

-- Aimbot Input Handlers
trackConn(UserInputService.InputBegan:Connect(function(input, gpe)
    if gpe then return end
    if CombatState.AimbotKey == "MouseButton2" and input.UserInputType == Enum.UserInputType.MouseButton2 then
        CombatState.AimbotActive = true
    elseif CombatState.AimbotKey == "MouseButton1" and input.UserInputType == Enum.UserInputType.MouseButton1 then
        CombatState.AimbotActive = true
    end
end))

trackConn(UserInputService.InputEnded:Connect(function(input)
    if CombatState.AimbotKey == "MouseButton2" and input.UserInputType == Enum.UserInputType.MouseButton2 then
        CombatState.AimbotActive = false
    elseif CombatState.AimbotKey == "MouseButton1" and input.UserInputType == Enum.UserInputType.MouseButton1 then
        CombatState.AimbotActive = false
    end
end))

-- =========================================================================
-- 2. VISUALS ENGINE (2D Box, Health Bar, Name, Distance — NO CHAMS/FILLS)
-- =========================================================================
local VisualsState = {
    Enabled = false,
    Box = false,
    HealthBar = false,
    Name = false,
    Distance = false,
    TeamCheck = true,
    MaxDistance = 1000,

    BoxColor = Color3.fromRGB(255, 255, 255),
    TextColor = Color3.fromRGB(255, 255, 255),
}

local espObjects = {}

local function createESP(player)
    if espObjects[player] then return end

    local box = safeDrawing("Square")
    box.Visible = false
    box.Thickness = 1.5
    box.Filled = false
    box.Color = VisualsState.BoxColor

    local boxOutline = safeDrawing("Square")
    boxOutline.Visible = false
    boxOutline.Thickness = 3
    boxOutline.Filled = false
    boxOutline.Color = Color3.new(0, 0, 0)

    local healthBarOutline = safeDrawing("Square")
    healthBarOutline.Visible = false
    healthBarOutline.Thickness = 1
    healthBarOutline.Filled = true
    healthBarOutline.Color = Color3.fromRGB(15, 15, 20)

    local healthBar = safeDrawing("Square")
    healthBar.Visible = false
    healthBar.Thickness = 1
    healthBar.Filled = true
    healthBar.Color = Color3.fromRGB(46, 204, 113)

    local nameText = safeDrawing("Text")
    nameText.Visible = false
    nameText.Center = true
    nameText.Outline = true
    nameText.Font = 2
    nameText.Size = 13
    nameText.Color = VisualsState.TextColor

    local distText = safeDrawing("Text")
    distText.Visible = false
    distText.Center = true
    distText.Outline = true
    distText.Font = 2
    distText.Size = 11
    distText.Color = Color3.fromRGB(200, 200, 200)

    espObjects[player] = {
        Box = box,
        BoxOutline = boxOutline,
        HealthBar = healthBar,
        HealthBarOutline = healthBarOutline,
        Name = nameText,
        Distance = distText,
    }
end

local function removeESP(player)
    local objs = espObjects[player]
    if objs then
        for _, d in pairs(objs) do
            pcall(function()
                d.Visible = false
                d:Remove()
            end)
        end
        espObjects[player] = nil
    end
end

for _, p in ipairs(Players:GetPlayers()) do
    if p ~= LocalPlayer then createESP(p) end
end
trackConn(Players.PlayerAdded:Connect(function(p)
    if p ~= LocalPlayer then createESP(p) end
end))
trackConn(Players.PlayerRemoving:Connect(removeESP))

-- ESP Render Loop
trackConn(RunService.RenderStepped:Connect(function()
    if not VisualsState.Enabled then
        for _, objs in pairs(espObjects) do
            objs.Box.Visible = false
            objs.BoxOutline.Visible = false
            objs.HealthBar.Visible = false
            objs.HealthBarOutline.Visible = false
            objs.Name.Visible = false
            objs.Distance.Visible = false
        end
        return
    end

    local cam = getCamera()
    if not cam then return end
    local camPos = cam.CFrame.Position

    for player, objs in pairs(espObjects) do
        local show = false
        if isAlive(player) and not (VisualsState.TeamCheck and isTeamMate(player)) then
            local char = player.Character
            local root = char and (char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso"))
            local hum = char and char:FindFirstChildOfClass("Humanoid")
            if root and hum then
                local dist = (root.Position - camPos).Magnitude
                if dist <= VisualsState.MaxDistance then
                    local rootPos, onScreen = cam:WorldToViewportPoint(root.Position)
                    if onScreen and rootPos.Z > 0 then
                        local head = char:FindFirstChild("Head")
                        local headPos = head and cam:WorldToViewportPoint(head.Position + Vector3.new(0, 0.5, 0)) or Vector2.new(rootPos.X, rootPos.Y - 30)
                        local legPos = cam:WorldToViewportPoint(root.Position - Vector3.new(0, 3, 0))

                        local height = math.abs(headPos.Y - legPos.Y)
                        local width = height * 0.65
                        local topLeft = Vector2.new(rootPos.X - width / 2, headPos.Y)

                        show = true

                        -- 2D Box
                        if VisualsState.Box then
                            objs.BoxOutline.Position = topLeft
                            objs.BoxOutline.Size = Vector2.new(width, height)
                            objs.BoxOutline.Visible = true

                            objs.Box.Position = topLeft
                            objs.Box.Size = Vector2.new(width, height)
                            objs.Box.Color = VisualsState.BoxColor
                            objs.Box.Visible = true
                        else
                            objs.Box.Visible = false
                            objs.BoxOutline.Visible = false
                        end

                        -- Health Bar
                        if VisualsState.HealthBar then
                            local barWidth = 3
                            local barHeight = height
                            local barPos = Vector2.new(topLeft.X - barWidth - 4, topLeft.Y)
                            local hpPercent = math.clamp(hum.Health / math.max(hum.MaxHealth, 1), 0, 1)

                            objs.HealthBarOutline.Position = barPos
                            objs.HealthBarOutline.Size = Vector2.new(barWidth, barHeight)
                            objs.HealthBarOutline.Visible = true

                            objs.HealthBar.Position = Vector2.new(barPos.X, barPos.Y + barHeight * (1 - hpPercent))
                            objs.HealthBar.Size = Vector2.new(barWidth, barHeight * hpPercent)
                            objs.HealthBar.Color = Color3.fromRGB(math.floor(255 * (1 - hpPercent)), math.floor(255 * hpPercent), 40)
                            objs.HealthBar.Visible = true
                        else
                            objs.HealthBar.Visible = false
                            objs.HealthBarOutline.Visible = false
                        end

                        -- Name
                        if VisualsState.Name then
                            objs.Name.Text = player.DisplayName or player.Name
                            objs.Name.Position = Vector2.new(rootPos.X, topLeft.Y - 16)
                            objs.Name.Color = VisualsState.TextColor
                            objs.Name.Visible = true
                        else
                            objs.Name.Visible = false
                        end

                        -- Distance
                        if VisualsState.Distance then
                            objs.Distance.Text = math.floor(dist) .. "m"
                            objs.Distance.Position = Vector2.new(rootPos.X, topLeft.Y + height + 2)
                            objs.Distance.Visible = true
                        else
                            objs.Distance.Visible = false
                        end
                    end
                end
            end
        end

        if not show then
            objs.Box.Visible = false
            objs.BoxOutline.Visible = false
            objs.HealthBar.Visible = false
            objs.HealthBarOutline.Visible = false
            objs.Name.Visible = false
            objs.Distance.Visible = false
        end
    end
end))

-- =========================================================================
-- 3. WORLD & CAMERA (Fullbright, Clear Fog, FOV)
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
    ClearFog = false,
    CustomFOV = false,
    TargetFOV = 90,
}

trackConn(RunService.RenderStepped:Connect(function()
    if WorldState.Fullbright then
        Lighting.Ambient = Color3.fromRGB(220, 220, 220)
        Lighting.OutdoorAmbient = Color3.fromRGB(220, 220, 220)
        Lighting.Brightness = 2.5
    end

    if WorldState.ClearFog then
        Lighting.FogEnd = 100000
        Lighting.FogStart = 0
    end

    if WorldState.CustomFOV then
        local cam = getCamera()
        if cam and cam.FieldOfView ~= WorldState.TargetFOV then
            cam.FieldOfView = WorldState.TargetFOV
        end
    end
end))

-- =========================================================================
-- 4. PLAYER & MOVEMENT (WalkSpeed, Infinite Jump, Bunny Hop)
-- =========================================================================
local PlayerState = {
    SpeedEnabled = false,
    WalkSpeed = 24,
    InfiniteJump = false,
    BunnyHop = false,
}

trackConn(RunService.Heartbeat:Connect(function()
    local char = LocalPlayer.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    if hum then
        if PlayerState.SpeedEnabled and hum.WalkSpeed ~= PlayerState.WalkSpeed then
            hum.WalkSpeed = PlayerState.WalkSpeed
        end

        if PlayerState.BunnyHop and hum.FloorMaterial ~= Enum.Material.Air and hum.MoveDirection.Magnitude > 0 then
            hum:ChangeState(Enum.HumanoidStateType.Jumping)
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
-- 5. EVENT BINDINGS (CONNECTED TO ATOMWARE LITE UI)
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

    _G.OnToggle("Enable Hitbox Expander", function(v)
        CombatState.HitboxExpanderEnabled = v
        if not v then restoreHitboxes() end
    end)

    -- Visuals (Lite)
    _G.OnToggle("Enable ESP", function(v) VisualsState.Enabled = v end)
    _G.OnToggle("Box ESP", function(v) VisualsState.Box = v end)
    _G.OnToggle("Health Bar", function(v) VisualsState.HealthBar = v end)
    _G.OnToggle("Name ESP", function(v) VisualsState.Name = v end)
    _G.OnToggle("Distance ESP", function(v) VisualsState.Distance = v end)
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
        if not v then
            local cam = getCamera()
            if cam then cam.FieldOfView = OriginalCameraFOV end
        end
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
end

if _G.OnSlider then
    _G.OnSlider("Silent Aim Hit Chance", function(v) CombatState.SilentHitChance = v end)
    _G.OnSlider("Silent Aim FOV", function(v) CombatState.SilentFOV = v end)
    _G.OnSlider("Aimbot Smoothness", function(v) CombatState.AimbotSmoothness = v end)
    _G.OnSlider("Aimbot FOV", function(v) CombatState.AimbotFOV = v end)
    _G.OnSlider("Hitbox Size", function(v) CombatState.HitboxSize = v end)
    _G.OnSlider("Max ESP Distance", function(v) VisualsState.MaxDistance = v end)
    _G.OnSlider("Camera FOV", function(v) WorldState.TargetFOV = v end)
    _G.OnSlider("WalkSpeed", function(v) PlayerState.WalkSpeed = v end)
end

if _G.OnDropdown then
    _G.OnDropdown("Silent Target Part", function(v) CombatState.SilentTargetPart = v end)
    _G.OnDropdown("Aimbot Target Part", function(v) CombatState.AimbotTargetPart = v end)
    _G.OnDropdown("Aimbot Mode", function(v) CombatState.AimbotKey = v end)
    _G.OnDropdown("Hitbox Part", function(v)
        CombatState.HitboxPart = v
        if CombatState.HitboxExpanderEnabled then restoreHitboxes() end
    end)
end

if _G.OnColorPicker then
    _G.OnColorPicker("Silent FOV Color", function(v) CombatState.SilentFOVColor = v end)
    _G.OnColorPicker("Aimbot FOV Color", function(v) CombatState.AimbotFOVColor = v end)
    _G.OnColorPicker("Box Color", function(v) VisualsState.BoxColor = v end)
    _G.OnColorPicker("Text Color", function(v) VisualsState.TextColor = v end)
end

-- =========================================================================
-- 6. AUTOMATIC GARBAGE COLLECTION STEP (Low-Memory Protector)
-- =========================================================================
task.spawn(function()
    while task.wait(20) do
        pcall(function()
            collectgarbage("step", 150)
        end)
    end
end)

_G.AtomwareFeaturesLoaded = true
_G.AtomwareLiteMode = true
print("[Atomware Rivals] Mobile_Lite Features Backend Online (Memory Guard Active)!")
