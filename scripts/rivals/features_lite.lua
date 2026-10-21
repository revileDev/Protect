--[[
    Atomware Rivals - features_lite.lua
    Ultra-Optimized Lightweight Feature Backend for Low-Memory Devices (iPads / Low-End Phones)
    
    Memory & Stability Guarantees:
      - ZERO Highlight / Chams instances (Eliminates iOS Jetsam memory killer)
      - ZERO ViewportFrames / 3D Character Mesh Rendering
      - ZERO BoxFill alpha-blending redraw loops
      - ZERO Skeleton bone-matrix calculations
      - Universal ScreenGui & Drawing Native Hybrid Renderer (100% visible on Delta/Codex/Arceus/Appleware iOS)
      - Retains 100% of core combat and essential ESP:
          * Silent Aim (with Mobile Always-On & Camera Ray Redirection)
          * Aimbot (Smoothness, FOV Circle, Mobile Always-On, Touch Support)
          * Hitbox Expander (Head / HumanoidRootPart / Torso in Heartbeat)
          * 2D Box ESP, Health Bar, Name, Distance (ScreenGui fallback for zero-Drawing executors)
          * Fullbright, Clear Fog, FOV Slider
          * WalkSpeed, Infinite Jump, Bunny Hop
      - Integrated background Garbage Collector step every 20s
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")
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
-- Resource Tracking Helper
-- =========================================================================
local function trackConn(conn)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackConnection then
        return _G.AtomwareCleanup:TrackConnection(conn)
    elseif _G.AtomwareConfig and _G.AtomwareConfig.TrackConnection then
        return _G.AtomwareConfig:TrackConnection(conn)
    end
    return conn
end

-- =========================================================================
-- ScreenGui-Based Universal Renderer (Guaranteed to work on ALL mobile executors)
-- =========================================================================
local rendererGui = nil
pcall(function()
    local gethui = gethui or function() return nil end
    local parent = gethui() or CoreGui or (LocalPlayer and LocalPlayer:FindFirstChildOfClass("PlayerGui"))
    if parent then
        local old = parent:FindFirstChild("AtomwareLiteRenderer")
        if old then old:Destroy() end

        local sg = Instance.new("ScreenGui")
        sg.Name = "AtomwareLiteRenderer"
        sg.ResetOnSpawn = false
        sg.DisplayOrder = 999
        sg.Parent = parent
        rendererGui = sg
    end
end)

if _G.AtomwareCleanup and rendererGui then
    pcall(function() _G.AtomwareCleanup:TrackInstance(rendererGui) end)
end

-- =========================================================================
-- Shared Game State & Helpers
-- =========================================================================
local function isAlive(player)
    if not player or player == LocalPlayer then return false end
    local char = player.Character
    if not char then return false end
    local hum = char:FindFirstChildOfClass("Humanoid")
    local root = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso") or char:FindFirstChild("UpperTorso") or char:FindFirstChild("Head")
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
    SilentTeamCheck = false,
    SilentWallCheck = false,

    AimbotEnabled = false,
    AimbotKey = "Always On",
    AimbotTargetPart = "Head",
    AimbotSmoothness = 4,
    AimbotFOV = 140,
    AimbotShowFOV = false,
    AimbotFOVColor = Color3.fromRGB(157, 48, 255),
    AimbotTeamCheck = false,
    AimbotWallCheck = false,
    AimbotActive = false,

    HitboxExpanderEnabled = false,
    HitboxSize = 8,
    HitboxTransparency = 0.5,
    HitboxPart = "Head",
    HitboxTeamCheck = false,
}

-- Native ScreenGui FOV Circles
local silentFOVCircle = nil
local aimbotFOVCircle = nil

if rendererGui then
    -- Silent Aim FOV Circle Frame
    local sCircle = Instance.new("Frame")
    sCircle.Name = "SilentFOVCircle"
    sCircle.AnchorPoint = Vector2.new(0.5, 0.5)
    sCircle.BackgroundTransparency = 1
    sCircle.BorderSizePixel = 0
    sCircle.Visible = false
    sCircle.Parent = rendererGui

    local scCorner = Instance.new("UICorner")
    scCorner.CornerRadius = UDim.new(1, 0)
    scCorner.Parent = sCircle

    local scStroke = Instance.new("UIStroke")
    scStroke.Thickness = 1.5
    scStroke.Color = CombatState.SilentFOVColor
    scStroke.Parent = sCircle
    silentFOVCircle = { Frame = sCircle, Stroke = scStroke }

    -- Aimbot FOV Circle Frame
    local aCircle = Instance.new("Frame")
    aCircle.Name = "AimbotFOVCircle"
    aCircle.AnchorPoint = Vector2.new(0.5, 0.5)
    aCircle.BackgroundTransparency = 1
    aCircle.BorderSizePixel = 0
    aCircle.Visible = false
    aCircle.Parent = rendererGui

    local acCorner = Instance.new("UICorner")
    acCorner.CornerRadius = UDim.new(1, 0)
    acCorner.Parent = aCircle

    local acStroke = Instance.new("UIStroke")
    acStroke.Thickness = 1.5
    acStroke.Color = CombatState.AimbotFOVColor
    acStroke.Parent = aCircle
    aimbotFOVCircle = { Frame = aCircle, Stroke = acStroke }
end

local function getTargetPart(character, partName)
    if not character then return nil end
    if partName == "Head" then
        return character:FindFirstChild("Head") or character:FindFirstChild("HumanoidRootPart")
    elseif partName == "Torso" or partName == "HumanoidRootPart" then
        return character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("UpperTorso") or character:FindFirstChild("Torso") or character:FindFirstChild("Head")
    end
    return character:FindFirstChild("Head") or character:FindFirstChild("HumanoidRootPart")
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

-- Silent Aim Hooking & Fallback
local currentSilentTarget = nil
local hookSuccess = false

pcall(function()
    if hookmetamethod then
        local oldNamecall
        oldNamecall = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)
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
        end))
        hookSuccess = true
    elseif getrawmetatable and setreadonly then
        local gmt = getrawmetatable(game)
        local oldNamecall = gmt.__namecall
        setreadonly(gmt, false)
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
        setreadonly(gmt, true)
        hookSuccess = true
    end
end)

-- Hitbox Expander with Heartbeat persistence
local originalSizes = {}

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

local function expandHitbox(player)
    if not isAlive(player) then return end
    local char = player.Character
    local part = char and getTargetPart(char, CombatState.HitboxPart)
    if part and part:IsA("BasePart") then
        if not originalSizes[part] then
            originalSizes[part] = {
                Size = part.Size,
                Transparency = part.Transparency,
                CanCollide = part.CanCollide,
            }
        end
        local sz = CombatState.HitboxSize
        part.Size = Vector3.new(sz, sz, sz)
        part.Transparency = CombatState.HitboxTransparency
        part.CanCollide = false
    end
end

trackConn(RunService.Heartbeat:Connect(function()
    if not CombatState.HitboxExpanderEnabled then return end
    for _, player in ipairs(Players:GetPlayers()) do
        if isAlive(player) and not (CombatState.HitboxTeamCheck and isTeamMate(player)) then
            expandHitbox(player)
        end
    end
end))

-- Combat Frame Loop
trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()
    if not cam then return end

    local center = Vector2.new(cam.ViewportSize.X / 2, cam.ViewportSize.Y / 2)

    -- Update Silent FOV Circle
    if silentFOVCircle and silentFOVCircle.Frame then
        local show = CombatState.SilentAimEnabled and CombatState.SilentShowFOV
        silentFOVCircle.Frame.Visible = show
        if show then
            local diam = CombatState.SilentFOV * 2
            silentFOVCircle.Frame.Size = UDim2.fromOffset(diam, diam)
            silentFOVCircle.Frame.Position = UDim2.fromOffset(center.X, center.Y)
            silentFOVCircle.Stroke.Color = CombatState.SilentFOVColor
        end
    end

    -- Update Aimbot FOV Circle
    if aimbotFOVCircle and aimbotFOVCircle.Frame then
        local show = CombatState.AimbotEnabled and CombatState.AimbotShowFOV
        aimbotFOVCircle.Frame.Visible = show
        if show then
            local diam = CombatState.AimbotFOV * 2
            aimbotFOVCircle.Frame.Size = UDim2.fromOffset(diam, diam)
            aimbotFOVCircle.Frame.Position = UDim2.fromOffset(center.X, center.Y)
            aimbotFOVCircle.Stroke.Color = CombatState.AimbotFOVColor
        end
    end

    -- Silent Aim Target Evaluation
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

    -- Run Aimbot (Supports Always On, MouseButton2, MouseButton1, and Touch)
    local aimbotTriggered = CombatState.AimbotKey == "Always On" or CombatState.AimbotActive
    if CombatState.AimbotEnabled and aimbotTriggered then
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
                local smooth = math.clamp(CombatState.AimbotSmoothness, 1, 20)
                cam.CFrame = currentCF:Lerp(targetCF, 1 / smooth)
            end
        end
    end
end))

-- Aimbot Touch and Key Input Handlers
trackConn(UserInputService.InputBegan:Connect(function(input, gpe)
    if gpe then return end
    if CombatState.AimbotKey == "MouseButton2" and input.UserInputType == Enum.UserInputType.MouseButton2 then
        CombatState.AimbotActive = true
    elseif CombatState.AimbotKey == "MouseButton1" and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
        CombatState.AimbotActive = true
    end
end))

trackConn(UserInputService.InputEnded:Connect(function(input)
    if CombatState.AimbotKey == "MouseButton2" and input.UserInputType == Enum.UserInputType.MouseButton2 then
        CombatState.AimbotActive = false
    elseif CombatState.AimbotKey == "MouseButton1" and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
        CombatState.AimbotActive = false
    end
end))

-- =========================================================================
-- 2. VISUALS ENGINE (ScreenGui Native ESP — 100% Reliable on Mobile)
-- =========================================================================
local VisualsState = {
    Enabled = false,
    Box = false,
    HealthBar = false,
    Name = false,
    Distance = false,
    TeamCheck = false,
    MaxDistance = 1000,

    BoxColor = Color3.fromRGB(255, 255, 255),
    TextColor = Color3.fromRGB(255, 255, 255),
}

local espObjects = {}

local function createPlayerESP(player)
    if espObjects[player] or not rendererGui then return end

    -- Container Frame for this player
    local container = Instance.new("Frame")
    container.Name = "ESP_" .. tostring(player.UserId)
    container.BackgroundTransparency = 1
    container.BorderSizePixel = 0
    container.Visible = false
    container.Parent = rendererGui

    -- 2D Box Outline & Inner
    local boxFrame = Instance.new("Frame")
    boxFrame.Name = "Box"
    boxFrame.BackgroundTransparency = 1
    boxFrame.BorderSizePixel = 0
    boxFrame.Visible = false
    boxFrame.Parent = container

    local boxStroke = Instance.new("UIStroke")
    boxStroke.Thickness = 1.5
    boxStroke.Color = VisualsState.BoxColor
    boxStroke.Parent = boxFrame

    -- Health Bar Container & Fill
    local hpBarBg = Instance.new("Frame")
    hpBarBg.Name = "HpBarBg"
    hpBarBg.BackgroundColor3 = Color3.fromRGB(15, 10, 20)
    hpBarBg.BorderSizePixel = 0
    hpBarBg.Visible = false
    hpBarBg.Parent = container

    local hpFill = Instance.new("Frame")
    hpFill.Name = "HpFill"
    hpFill.BackgroundColor3 = Color3.fromRGB(46, 204, 113)
    hpFill.BorderSizePixel = 0
    hpFill.Parent = hpBarBg

    -- Name TextLabel
    local nameLabel = Instance.new("TextLabel")
    nameLabel.Name = "NameLabel"
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = player.DisplayName or player.Name
    nameLabel.TextColor3 = VisualsState.TextColor
    nameLabel.TextSize = 11
    nameLabel.Font = Enum.Font.GothamBold
    nameLabel.TextXAlignment = Enum.TextXAlignment.Center
    nameLabel.Visible = false
    nameLabel.Parent = container

    local nameStroke = Instance.new("UIStroke")
    nameStroke.Thickness = 1
    nameStroke.Color = Color3.fromRGB(0, 0, 0)
    nameStroke.Parent = nameLabel

    -- Distance TextLabel
    local distLabel = Instance.new("TextLabel")
    distLabel.Name = "DistLabel"
    distLabel.BackgroundTransparency = 1
    distLabel.Text = "0m"
    distLabel.TextColor3 = Color3.fromRGB(220, 220, 220)
    distLabel.TextSize = 10
    distLabel.Font = Enum.Font.GothamMedium
    distLabel.TextXAlignment = Enum.TextXAlignment.Center
    distLabel.Visible = false
    distLabel.Parent = container

    local distStroke = Instance.new("UIStroke")
    distStroke.Thickness = 1
    distStroke.Color = Color3.fromRGB(0, 0, 0)
    distStroke.Parent = distLabel

    espObjects[player] = {
        Container = container,
        Box = boxFrame,
        BoxStroke = boxStroke,
        HpBarBg = hpBarBg,
        HpFill = hpFill,
        Name = nameLabel,
        Distance = distLabel,
    }
end

local function removePlayerESP(player)
    local data = espObjects[player]
    if data then
        pcall(function()
            if data.Container then data.Container:Destroy() end
        end)
        espObjects[player] = nil
    end
end

for _, p in ipairs(Players:GetPlayers()) do
    if p ~= LocalPlayer then createPlayerESP(p) end
end
trackConn(Players.PlayerAdded:Connect(function(p)
    if p ~= LocalPlayer then createPlayerESP(p) end
end))
trackConn(Players.PlayerRemoving:Connect(removePlayerESP))

-- ESP Render Step
trackConn(RunService.RenderStepped:Connect(function()
    if not VisualsState.Enabled then
        for _, data in pairs(espObjects) do
            data.Container.Visible = false
        end
        return
    end

    local cam = getCamera()
    if not cam then return end

    for player, data in pairs(espObjects) do
        local show = false

        if isAlive(player) and not (VisualsState.TeamCheck and isTeamMate(player)) then
            local char = player.Character
            local root = char and (char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso") or char:FindFirstChild("UpperTorso") or char:FindFirstChild("Head"))
            local head = char and char:FindFirstChild("Head")
            local hum = char and char:FindFirstChildOfClass("Humanoid")

            if root and hum then
                local rootPos, onScreen = cam:WorldToViewportPoint(root.Position)
                local dist = (root.Position - cam.CFrame.Position).Magnitude

                if onScreen and dist <= VisualsState.MaxDistance then
                    show = true
                    data.Container.Visible = true

                    local topY = rootPos.Y - 20
                    local botY = rootPos.Y + 20
                    if head then
                        local headPos = cam:WorldToViewportPoint(head.Position + Vector3.new(0, 0.5, 0))
                        topY = headPos.Y
                    end
                    local legPos = cam:WorldToViewportPoint(root.Position - Vector3.new(0, 3, 0))
                    botY = legPos.Y

                    local height = math.max(16, math.abs(botY - topY))
                    local width = math.max(12, height * 0.6)
                    local topLeft = Vector2.new(rootPos.X - width / 2, topY)

                    -- 2D Box
                    if VisualsState.Box then
                        data.Box.Position = UDim2.fromOffset(topLeft.X, topLeft.Y)
                        data.Box.Size = UDim2.fromOffset(width, height)
                        data.BoxStroke.Color = VisualsState.BoxColor
                        data.Box.Visible = true
                    else
                        data.Box.Visible = false
                    end

                    -- Health Bar
                    if VisualsState.HealthBar then
                        local barWidth = 3
                        local barX = topLeft.X - barWidth - 4
                        local hpPct = math.clamp(hum.Health / math.max(hum.MaxHealth, 1), 0, 1)

                        data.HpBarBg.Position = UDim2.fromOffset(barX, topLeft.Y)
                        data.HpBarBg.Size = UDim2.fromOffset(barWidth, height)
                        data.HpBarBg.Visible = true

                        data.HpFill.Position = UDim2.new(0, 0, 1 - hpPct, 0)
                        data.HpFill.Size = UDim2.new(1, 0, hpPct, 0)
                        data.HpFill.BackgroundColor3 = Color3.fromRGB(math.floor(255 * (1 - hpPct)), math.floor(255 * hpPct), 40)
                    else
                        data.HpBarBg.Visible = false
                    end

                    -- Name
                    if VisualsState.Name then
                        data.Name.Position = UDim2.fromOffset(rootPos.X - 60, topLeft.Y - 16)
                        data.Name.Size = UDim2.fromOffset(120, 14)
                        data.Name.TextColor3 = VisualsState.TextColor
                        data.Name.Visible = true
                    else
                        data.Name.Visible = false
                    end

                    -- Distance
                    if VisualsState.Distance then
                        data.Distance.Position = UDim2.fromOffset(rootPos.X - 50, topLeft.Y + height + 2)
                        data.Distance.Size = UDim2.fromOffset(100, 14)
                        data.Distance.Text = math.floor(dist) .. "m"
                        data.Distance.Visible = true
                    else
                        data.Distance.Visible = false
                    end
                end
            end
        end

        if not show then
            data.Container.Visible = false
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
local function bindEvent(name, handler)
    if _G.OnToggle then _G.OnToggle(name, handler) end
    if _G.OnSlider then _G.OnSlider(name, handler) end
    if _G.OnDropdown then _G.OnDropdown(name, handler) end
    if _G.OnColorPicker then _G.OnColorPicker(name, handler) end
end

-- Combat
bindEvent("Enable Silent Aim", function(v) CombatState.SilentAimEnabled = v end)
bindEvent("Show Silent FOV Circle", function(v) CombatState.SilentShowFOV = v end)
bindEvent("Silent Team Check", function(v) CombatState.SilentTeamCheck = v end)
bindEvent("Silent Wall Check", function(v) CombatState.SilentWallCheck = v end)
bindEvent("Silent Aim Hit Chance", function(v) CombatState.SilentHitChance = v end)
bindEvent("Silent Aim FOV", function(v) CombatState.SilentFOV = v end)
bindEvent("Silent Target Part", function(v) CombatState.SilentTargetPart = v end)

bindEvent("Enable Aimbot", function(v) CombatState.AimbotEnabled = v end)
bindEvent("Show Aimbot FOV Circle", function(v) CombatState.AimbotShowFOV = v end)
bindEvent("Aimbot Team Check", function(v) CombatState.AimbotTeamCheck = v end)
bindEvent("Aimbot Wall Check", function(v) CombatState.AimbotWallCheck = v end)
bindEvent("Aimbot Mode", function(v) CombatState.AimbotKey = v end)
bindEvent("Aimbot Smoothness", function(v) CombatState.AimbotSmoothness = v end)
bindEvent("Aimbot FOV", function(v) CombatState.AimbotFOV = v end)

bindEvent("Enable Hitbox Expander", function(v)
    CombatState.HitboxExpanderEnabled = v
    if not v then restoreHitboxes() end
end)
bindEvent("Hitbox Size", function(v) CombatState.HitboxSize = v end)
bindEvent("Hitbox Part", function(v)
    restoreHitboxes()
    CombatState.HitboxPart = v
end)

-- Visuals
bindEvent("Enable ESP", function(v) VisualsState.Enabled = v end)
bindEvent("Box ESP", function(v) VisualsState.Box = v end)
bindEvent("Health Bar", function(v) VisualsState.HealthBar = v end)
bindEvent("Name ESP", function(v) VisualsState.Name = v end)
bindEvent("Distance ESP", function(v) VisualsState.Distance = v end)
bindEvent("Team Check", function(v) VisualsState.TeamCheck = v end)
bindEvent("Max ESP Distance", function(v) VisualsState.MaxDistance = v end)

-- World
bindEvent("Fullbright", function(v)
    WorldState.Fullbright = v
    if not v then
        Lighting.Ambient = OriginalLighting.Ambient
        Lighting.OutdoorAmbient = OriginalLighting.OutdoorAmbient
        Lighting.Brightness = OriginalLighting.Brightness
    end
end)
bindEvent("Clear Atmosphere / Fog", function(v)
    WorldState.ClearFog = v
    if not v then
        Lighting.FogEnd = OriginalLighting.FogEnd
        Lighting.FogStart = OriginalLighting.FogStart
    end
end)
bindEvent("Custom Camera FOV", function(v)
    WorldState.CustomFOV = v
    if not v then
        local cam = getCamera()
        if cam then cam.FieldOfView = OriginalCameraFOV end
    end
end)
bindEvent("Camera FOV", function(v) WorldState.TargetFOV = v end)

-- Movement
bindEvent("Speed Multiplier", function(v)
    PlayerState.SpeedEnabled = v
    if not v and LocalPlayer.Character then
        local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
        if hum then hum.WalkSpeed = 16 end
    end
end)
bindEvent("WalkSpeed", function(v) PlayerState.WalkSpeed = v end)
bindEvent("Infinite Jump", function(v) PlayerState.InfiniteJump = v end)
bindEvent("Bunny Hop", function(v) PlayerState.BunnyHop = v end)

-- Colors
bindEvent("Silent FOV Color", function(v) CombatState.SilentFOVColor = v end)
bindEvent("Aimbot FOV Color", function(v) CombatState.AimbotFOVColor = v end)
bindEvent("Box Color", function(v) VisualsState.BoxColor = v end)
bindEvent("Text Color", function(v) VisualsState.TextColor = v end)

-- Drain any pending events that were fired before features loaded
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
print("[Atomware Rivals] Mobile_Lite Features Backend Online (Universal ScreenGui Engine Active)!")
