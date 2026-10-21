--[[
    features.lua
    Unified High-Performance Feature Backend for Atomware (Rivals)
    Includes: Combat (Silent Aim, Aimbot, Triggerbot, Hitbox Expander),
    Visuals (2D Box, Box Fill, Health, Name, Distance, Weapon, Skeleton, Snaplines, Head Dot, Offscreen, Chams),
    World (Fullbright, Clear Fog, Shadows, Time of Day, FOV, Third Person, Tracers, Hit Sounds),
    and Player (Speed, Infinite Jump, Bunny Hop, Fly, Noclip, Spinbot, Crosshair)
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")

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

local function trackInst(inst)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackInstance then
        return _G.AtomwareCleanup:TrackInstance(inst)
    end
    return inst
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
    -- Fallback dummy object if executor lacks Drawing library
    local dummy = {
        Visible = false,
        Transparency = 1,
        Color = Color3.new(1, 1, 1),
        Thickness = 1,
        Filled = false,
        Position = Vector2.zero,
        Size = Vector2.zero,
        From = Vector2.zero,
        To = Vector2.zero,
        PointA = Vector2.zero,
        PointB = Vector2.zero,
        PointC = Vector2.zero,
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
-- 1. COMBAT ENGINE (Silent Aim, Aimbot, Triggerbot, Hitbox Expander)
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
    AimbotKey = "MouseButton2",
    AimbotTargetPart = "Head",
    AimbotSmoothness = 5,
    AimbotFOV = 150,
    AimbotShowFOV = false,
    AimbotFOVColor = Color3.fromRGB(157, 48, 255),
    AimbotTeamCheck = true,
    AimbotWallCheck = true,
    AimbotActive = false,

    TriggerbotEnabled = false,
    TriggerbotDelay = 50,
    TriggerbotTeamCheck = true,
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

    if CombatState.AimbotEnabled and CombatState.AimbotActive and cam then
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

-- Triggerbot Heartbeat
trackConn(RunService.Heartbeat:Connect(function()
    if not CombatState.TriggerbotEnabled then return end
    local now = os.clock() * 1000
    if now - CombatState.TriggerbotLastShot < CombatState.TriggerbotDelay then return end
    local cam = getCamera()
    if not cam then return end

    local mousePos = UserInputService:GetMouseLocation()
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
        if isAlive(player) and not isTeamMate(player) then
            local char = player.Character
            local part = char and char:FindFirstChild(CombatState.HitboxPart)
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

-- Keybind input listener for Aimbot
local function isInputMatching(input, bindName)
    if not bindName or bindName == "None" then return false end
    if input.UserInputType == Enum.UserInputType.MouseButton1 and bindName == "MouseButton1" then return true end
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
-- 2. VISUALS & ESP ENGINE
-- =========================================================================
local VisualsState = {
    Enabled = false,
    Box = false,
    BoxFill = false,
    HealthBar = false,
    Name = false,
    Distance = false,
    Weapon = false,
    Skeleton = false,
    Snaplines = false,
    HeadDot = false,
    OffscreenArrows = false,
    Chams = false,
    TeamCheck = true,
    MaxDistance = 1500,

    BoxColor = Color3.fromRGB(255, 255, 255),
    BoxFillColor = Color3.fromRGB(157, 48, 255),
    BoxFillTransparency = 0.25,
    SkeletonColor = Color3.fromRGB(245, 241, 255),
    TextColor = Color3.fromRGB(245, 241, 255),
    SnaplineColor = Color3.fromRGB(205, 104, 255),
    SnaplineOrigin = "Bottom",
    HeadDotColor = Color3.fromRGB(255, 50, 50),
    HeadDotSize = 4,
    OffscreenColor = Color3.fromRGB(255, 75, 125),
    OffscreenRadius = 200,
    ChamsFillColor = Color3.fromRGB(157, 48, 255),
    ChamsOutlineColor = Color3.fromRGB(205, 104, 255),
}

local ESPCache = {}
local HighlightCache = {}

local SKELETON_BONES = {
    { "Head", "UpperTorso" },
    { "UpperTorso", "LowerTorso" },
    { "UpperTorso", "LeftUpperArm" },
    { "LeftUpperArm", "LeftLowerArm" },
    { "LeftLowerArm", "LeftHand" },
    { "UpperTorso", "RightUpperArm" },
    { "RightUpperArm", "RightLowerArm" },
    { "RightLowerArm", "RightHand" },
    { "LowerTorso", "LeftUpperLeg" },
    { "LeftUpperLeg", "LeftLowerLeg" },
    { "LeftLowerLeg", "LeftFoot" },
    { "LowerTorso", "RightUpperLeg" },
    { "RightUpperLeg", "RightLowerLeg" },
    { "RightLowerLeg", "RightFoot" },
}

local function createPlayerESP(player)
    local esp = {
        BoxOutline = safeDrawing("Square"),
        Box = safeDrawing("Square"),
        BoxFill = safeDrawing("Square"),
        HealthBarBg = safeDrawing("Square"),
        HealthBar = safeDrawing("Square"),
        Name = safeDrawing("Text"),
        Distance = safeDrawing("Text"),
        Weapon = safeDrawing("Text"),
        Snapline = safeDrawing("Line"),
        HeadDot = safeDrawing("Circle"),
        OffscreenArrow = safeDrawing("Triangle"),
        SkeletonLines = {},
    }

    esp.BoxOutline.Thickness = 3
    esp.BoxOutline.Filled = false
    esp.BoxOutline.Color = Color3.fromRGB(0, 0, 0)
    esp.BoxOutline.Visible = false

    esp.Box.Thickness = 1
    esp.Box.Filled = false
    esp.Box.Visible = false

    esp.BoxFill.Filled = true
    esp.BoxFill.Thickness = 0
    esp.BoxFill.Visible = false

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

    esp.HeadDot.Thickness = 1
    esp.HeadDot.Filled = true
    esp.HeadDot.NumSides = 16
    esp.HeadDot.Visible = false

    esp.OffscreenArrow.Filled = true
    esp.OffscreenArrow.Thickness = 1
    esp.OffscreenArrow.Visible = false

    for i = 1, 14 do
        local line = safeDrawing("Line")
        line.Thickness = 1.5
        line.Visible = false
        table.insert(esp.SkeletonLines, line)
    end

    ESPCache[player] = esp
    return esp
end

local function hideAllESP(esp)
    esp.BoxOutline.Visible = false
    esp.Box.Visible = false
    esp.BoxFill.Visible = false
    esp.HealthBarBg.Visible = false
    esp.HealthBar.Visible = false
    esp.Name.Visible = false
    esp.Distance.Visible = false
    esp.Weapon.Visible = false
    esp.Snapline.Visible = false
    esp.HeadDot.Visible = false
    esp.OffscreenArrow.Visible = false
    for _, l in ipairs(esp.SkeletonLines) do l.Visible = false end
end

local function removePlayerESP(player)
    local esp = ESPCache[player]
    if esp then
        hideAllESP(esp)
        ESPCache[player] = nil
    end
    local hl = HighlightCache[player]
    if hl then
        pcall(function() hl:Destroy() end)
        HighlightCache[player] = nil
    end
end

trackConn(Players.PlayerRemoving:Connect(removePlayerESP))

trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()
    if not cam then return end

    if not VisualsState.Enabled then
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        for _, hl in pairs(HighlightCache) do hl.Enabled = false end
        return
    end

    local vp = cam.ViewportSize
    local screenCenter = Vector2.new(vp.X / 2, vp.Y / 2)

    for _, player in ipairs(Players:GetPlayers()) do
        local esp = ESPCache[player] or createPlayerESP(player)

        if not isAlive(player) or (VisualsState.TeamCheck and isTeamMate(player)) then
            hideAllESP(esp)
            if HighlightCache[player] then HighlightCache[player].Enabled = false end
            continue
        end

        local char = player.Character
        local root = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso")
        local head = char:FindFirstChild("Head")
        local hum = char:FindFirstChildOfClass("Humanoid")

        if not root or not head or not hum then
            hideAllESP(esp)
            continue
        end

        local dist = (root.Position - cam.CFrame.Position).Magnitude
        if dist > VisualsState.MaxDistance then
            hideAllESP(esp)
            if HighlightCache[player] then HighlightCache[player].Enabled = false end
            continue
        end

        local rootPos, onScreen = cam:WorldToViewportPoint(root.Position)
        local headPos = cam:WorldToViewportPoint(head.Position + Vector3.new(0, 0.5, 0))
        local legPos = cam:WorldToViewportPoint(root.Position - Vector3.new(0, 3, 0))

        if VisualsState.Chams then
            local hl = HighlightCache[player]
            if not hl or not hl.Parent then
                hl = trackInst(Instance.new("Highlight"))
                hl.Name = "AtomwareChams"
                hl.Adornee = char
                hl.Parent = char
                HighlightCache[player] = hl
            end
            hl.Enabled = true
            hl.FillColor = VisualsState.ChamsFillColor
            hl.OutlineColor = VisualsState.ChamsOutlineColor
            hl.FillTransparency = 0.4
            hl.OutlineTransparency = 0
            hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
        elseif HighlightCache[player] then
            HighlightCache[player].Enabled = false
        end

        if onScreen then
            esp.OffscreenArrow.Visible = false

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

            if VisualsState.BoxFill then
                esp.BoxFill.Visible = true
                esp.BoxFill.Position = Vector2.new(boxX, boxY)
                esp.BoxFill.Size = Vector2.new(width, height)
                esp.BoxFill.Color = VisualsState.BoxFillColor
                esp.BoxFill.Transparency = VisualsState.BoxFillTransparency
            else
                esp.BoxFill.Visible = false
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

            if VisualsState.HeadDot then
                local hDotPos, hOn = cam:WorldToViewportPoint(head.Position)
                if hOn then
                    esp.HeadDot.Visible = true
                    esp.HeadDot.Position = Vector2.new(hDotPos.X, hDotPos.Y)
                    esp.HeadDot.Radius = VisualsState.HeadDotSize
                    esp.HeadDot.Color = VisualsState.HeadDotColor
                else
                    esp.HeadDot.Visible = false
                end
            else
                esp.HeadDot.Visible = false
            end

            if VisualsState.Skeleton then
                local lineIndex = 1
                for _, bone in ipairs(SKELETON_BONES) do
                    local p1 = char:FindFirstChild(bone[1])
                    local p2 = char:FindFirstChild(bone[2])
                    local line = esp.SkeletonLines[lineIndex]
                    if p1 and p2 and line then
                        local pos1, on1 = cam:WorldToViewportPoint(p1.Position)
                        local pos2, on2 = cam:WorldToViewportPoint(p2.Position)
                        if on1 and on2 then
                            line.Visible = true
                            line.From = Vector2.new(pos1.X, pos1.Y)
                            line.To = Vector2.new(pos2.X, pos2.Y)
                            line.Color = VisualsState.SkeletonColor
                        else
                            line.Visible = false
                        end
                    elseif line then
                        line.Visible = false
                    end
                    lineIndex = lineIndex + 1
                end
            else
                for _, l in ipairs(esp.SkeletonLines) do l.Visible = false end
            end
        else
            hideAllESP(esp)
            if VisualsState.OffscreenArrows then
                local relPos = cam.CFrame:PointToObjectSpace(root.Position)
                local angle = math.atan2(-relPos.X, relPos.Z)
                local rad = VisualsState.OffscreenRadius
                local arrowCenter = screenCenter + Vector2.new(math.sin(angle) * rad, -math.cos(angle) * rad)

                esp.OffscreenArrow.Visible = true
                esp.OffscreenArrow.PointA = arrowCenter + Vector2.new(math.sin(angle) * 12, -math.cos(angle) * 12)
                esp.OffscreenArrow.PointB = arrowCenter + Vector2.new(math.sin(angle + 2.5) * 8, -math.cos(angle + 2.5) * 8)
                esp.OffscreenArrow.PointC = arrowCenter + Vector2.new(math.sin(angle - 2.5) * 8, -math.cos(angle - 2.5) * 8)
                esp.OffscreenArrow.Color = VisualsState.OffscreenColor
            else
                esp.OffscreenArrow.Visible = false
            end
        end
    end
end))

-- =========================================================================
-- 3. WORLD & CAMERA ENGINE
-- =========================================================================
local OriginalLighting = {
    Ambient = Lighting.Ambient,
    OutdoorAmbient = Lighting.OutdoorAmbient,
    Brightness = Lighting.Brightness,
    GlobalShadows = Lighting.GlobalShadows,
    ClockTime = Lighting.ClockTime,
    FogEnd = Lighting.FogEnd,
    FogStart = Lighting.FogStart,
}
local OriginalCameraFOV = (Camera and Camera.FieldOfView) or 70

local WorldState = {
    Fullbright = false,
    Brightness = 3,
    NoShadows = false,
    ClearFog = false,
    TimeOfDay = 14,
    CustomTimeOfDay = false,

    CustomFOV = false,
    TargetFOV = 90,

    ThirdPerson = false,
    ThirdPersonDistance = 12,

    BulletTracers = false,
    TracerColor = Color3.fromRGB(205, 104, 255),
    HitmarkerSound = false,
}

local ActiveTracers = {}

local function createTracer(startPos, endPos, color)
    local line = safeDrawing("Line")
    line.Thickness = 1.5
    line.Transparency = 1
    line.Color = color or WorldState.TracerColor
    line.Visible = false

    table.insert(ActiveTracers, {
        Line = line,
        Start = startPos,
        End = endPos,
        Created = os.clock(),
        Duration = 0.6,
    })
end

local function playHitSound()
    if not WorldState.HitmarkerSound then return end
    local sound = Instance.new("Sound")
    sound.SoundId = "rbxassetid://6607204501"
    sound.Volume = 1.5
    sound.Parent = SoundService
    sound:Play()
    sound.Ended:Once(function() sound:Destroy() end)
end

trackConn(RunService.RenderStepped:Connect(function()
    local cam = getCamera()

    if WorldState.Fullbright then
        Lighting.Ambient = Color3.fromRGB(255, 255, 255)
        Lighting.OutdoorAmbient = Color3.fromRGB(255, 255, 255)
        Lighting.Brightness = WorldState.Brightness
    end

    if WorldState.NoShadows then
        Lighting.GlobalShadows = false
    end

    if WorldState.ClearFog then
        Lighting.FogEnd = 9e9
        Lighting.FogStart = 9e9
        local atmo = Lighting:FindFirstChildOfClass("Atmosphere")
        if atmo then atmo.Density = 0 end
    end

    if WorldState.CustomTimeOfDay then
        Lighting.ClockTime = WorldState.TimeOfDay
    end

    if WorldState.CustomFOV and cam then
        cam.FieldOfView = WorldState.TargetFOV
    end

    if WorldState.ThirdPerson and LocalPlayer.Character and cam then
        local root = LocalPlayer.Character:FindFirstChild("HumanoidRootPart") or LocalPlayer.Character:FindFirstChild("Head")
        if root then
            local lookVector = cam.CFrame.LookVector
            local targetPos = root.Position - (lookVector * WorldState.ThirdPersonDistance) + Vector3.new(0, 1.5, 0)
            cam.CFrame = CFrame.new(targetPos, targetPos + lookVector)
        end
    end

    local now = os.clock()
    for i = #ActiveTracers, 1, -1 do
        local tracer = ActiveTracers[i]
        local elapsed = now - tracer.Created
        if elapsed >= tracer.Duration then
            tracer.Line.Visible = false
            pcall(function() tracer.Line:Remove() end)
            table.remove(ActiveTracers, i)
        elseif cam then
            local p1, on1 = cam:WorldToViewportPoint(tracer.Start)
            local p2, on2 = cam:WorldToViewportPoint(tracer.End)
            if on1 or on2 then
                tracer.Line.Visible = true
                tracer.Line.From = Vector2.new(p1.X, p1.Y)
                tracer.Line.To = Vector2.new(p2.X, p2.Y)
                tracer.Line.Transparency = 1 - (elapsed / tracer.Duration)
            else
                tracer.Line.Visible = false
            end
        end
    end
end))

-- =========================================================================
-- 4. PLAYER & MOVEMENT ENGINE
-- =========================================================================
local PlayerState = {
    SpeedEnabled = false,
    WalkSpeed = 24,
    InfiniteJump = false,
    BunnyHop = false,
    FlyEnabled = false,
    FlySpeed = 50,
    Noclip = false,

    Spinbot = false,
    SpinSpeed = 15,

    Crosshair = false,
    CrosshairSize = 10,
    CrosshairGap = 4,
    CrosshairColor = Color3.fromRGB(205, 104, 255),
}

local chTop = safeDrawing("Line")
local chBottom = safeDrawing("Line")
local chLeft = safeDrawing("Line")
local chRight = safeDrawing("Line")

for _, line in ipairs({ chTop, chBottom, chLeft, chRight }) do
    line.Thickness = 1.5
    line.Visible = false
end

trackConn(RunService.RenderStepped:Connect(function()
    local char = LocalPlayer.Character
    local cam = getCamera()
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

        if PlayerState.Spinbot and root then
            root.CFrame = root.CFrame * CFrame.Angles(0, math.rad(PlayerState.SpinSpeed), 0)
        end
    end

    if PlayerState.Crosshair and cam then
        local vp = cam.ViewportSize
        local cx, cy = vp.X / 2, vp.Y / 2
        local sz, gap, col = PlayerState.CrosshairSize, PlayerState.CrosshairGap, PlayerState.CrosshairColor

        chTop.Visible = true
        chTop.From = Vector2.new(cx, cy - gap)
        chTop.To = Vector2.new(cx, cy - gap - sz)
        chTop.Color = col

        chBottom.Visible = true
        chBottom.From = Vector2.new(cx, cy + gap)
        chBottom.To = Vector2.new(cx, cy + gap + sz)
        chBottom.Color = col

        chLeft.Visible = true
        chLeft.From = Vector2.new(cx - gap, cy)
        chLeft.To = Vector2.new(cx - gap - sz, cy)
        chLeft.Color = col

        chRight.Visible = true
        chRight.From = Vector2.new(cx + gap, cy)
        chRight.To = Vector2.new(cx + gap + sz, cy)
        chRight.Color = col
    else
        chTop.Visible = false
        chBottom.Visible = false
        chLeft.Visible = false
        chRight.Visible = false
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

trackConn(RunService.Heartbeat:Connect(function()
    if not PlayerState.FlyEnabled then return end
    local char = LocalPlayer.Character
    local cam = getCamera()
    if not char or not cam then return end
    local root = char:FindFirstChild("HumanoidRootPart")
    local hum = char:FindFirstChildOfClass("Humanoid")
    if not root or not hum then return end

    local moveDir = hum.MoveDirection
    local camCF = cam.CFrame
    local flyVec = Vector3.zero

    if moveDir.Magnitude > 0 then
        local forward = camCF.LookVector
        local right = camCF.RightVector
        flyVec = (forward * moveDir.Z * -1 + right * moveDir.X).Unit * PlayerState.FlySpeed
    end

    if UserInputService:IsKeyDown(Enum.KeyCode.Space) then
        flyVec = flyVec + Vector3.new(0, PlayerState.FlySpeed, 0)
    elseif UserInputService:IsKeyDown(Enum.KeyCode.LeftShift) then
        flyVec = flyVec - Vector3.new(0, PlayerState.FlySpeed, 0)
    end

    root.AssemblyLinearVelocity = flyVec
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
    _G.OnToggle("Box Fill", function(v) VisualsState.BoxFill = v end)
    _G.OnToggle("Health Bar", function(v) VisualsState.HealthBar = v end)
    _G.OnToggle("Name ESP", function(v) VisualsState.Name = v end)
    _G.OnToggle("Distance ESP", function(v) VisualsState.Distance = v end)
    _G.OnToggle("Weapon ESP", function(v) VisualsState.Weapon = v end)
    _G.OnToggle("Skeleton ESP", function(v) VisualsState.Skeleton = v end)
    _G.OnToggle("Snaplines", function(v) VisualsState.Snaplines = v end)
    _G.OnToggle("Head Dot", function(v) VisualsState.HeadDot = v end)
    _G.OnToggle("Off-Screen Arrows", function(v) VisualsState.OffscreenArrows = v end)
    _G.OnToggle("Chams / Highlights", function(v) VisualsState.Chams = v end)
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
    _G.OnToggle("Remove Shadows", function(v)
        WorldState.NoShadows = v
        if not v then Lighting.GlobalShadows = OriginalLighting.GlobalShadows end
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
    _G.OnToggle("Third Person", function(v) WorldState.ThirdPerson = v end)
    _G.OnToggle("Bullet Tracers", function(v) WorldState.BulletTracers = v end)
    _G.OnToggle("Hitmarker Sound", function(v) WorldState.HitmarkerSound = v end)

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
    _G.OnToggle("Fly", function(v) PlayerState.FlyEnabled = v end)
    _G.OnToggle("Noclip", function(v) PlayerState.Noclip = v end)
    _G.OnToggle("Spinbot / Anti-Aim", function(v) PlayerState.Spinbot = v end)
    _G.OnToggle("Crosshair Overlay", function(v) PlayerState.Crosshair = v end)
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
    _G.OnSlider("Box Fill Transparency", function(v) VisualsState.BoxFillTransparency = v / 100 end)
    _G.OnSlider("Head Dot Size", function(v) VisualsState.HeadDotSize = v end)
    _G.OnSlider("Off-Screen Radius", function(v) VisualsState.OffscreenRadius = v end)

    _G.OnSlider("Brightness", function(v) WorldState.Brightness = v end)
    _G.OnSlider("World Time of Day", function(v)
        WorldState.CustomTimeOfDay = true
        WorldState.TimeOfDay = v
        Lighting.ClockTime = v
    end)
    _G.OnSlider("Camera FOV", function(v) WorldState.TargetFOV = v end)
    _G.OnSlider("Third Person Distance", function(v) WorldState.ThirdPersonDistance = v end)

    _G.OnSlider("WalkSpeed", function(v) PlayerState.WalkSpeed = v end)
    _G.OnSlider("Fly Speed", function(v) PlayerState.FlySpeed = v end)
    _G.OnSlider("Spin Speed", function(v) PlayerState.SpinSpeed = v end)
end

if _G.OnDropdown then
    _G.OnDropdown("Silent Target Part", function(v) CombatState.SilentTargetPart = v end)
    _G.OnDropdown("Aimbot Target Part", function(v) CombatState.AimbotTargetPart = v end)
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
    _G.OnColorPicker("Box Fill Color", function(v) VisualsState.BoxFillColor = v end)
    _G.OnColorPicker("Skeleton Color", function(v) VisualsState.SkeletonColor = v end)
    _G.OnColorPicker("Text Color", function(v) VisualsState.TextColor = v end)
    _G.OnColorPicker("Snapline Color", function(v) VisualsState.SnaplineColor = v end)
    _G.OnColorPicker("Head Dot Color", function(v) VisualsState.HeadDotColor = v end)
    _G.OnColorPicker("Off-Screen Color", function(v) VisualsState.OffscreenColor = v end)
    _G.OnColorPicker("Chams Fill Color", function(v) VisualsState.ChamsFillColor = v end)
    _G.OnColorPicker("Chams Outline Color", function(v) VisualsState.ChamsOutlineColor = v end)
    _G.OnColorPicker("Tracer Color", function(v) WorldState.TracerColor = v end)
end

if _G.OnKeybind then
    _G.OnKeybind("Aimbot Key", function(v) CombatState.AimbotKey = v end)
end

-- =========================================================================
-- Unload Cleanup Hook
-- =========================================================================
if _G.AtomwareConfig then
    _G.AtomwareConfig:OnUnload(function()
        restoreHitboxes()
        silentCircle.Visible = false
        aimbotCircle.Visible = false
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        for _, hl in pairs(HighlightCache) do pcall(function() hl:Destroy() end) end
        table.clear(ESPCache)
        table.clear(HighlightCache)

        Lighting.Ambient = OriginalLighting.Ambient
        Lighting.OutdoorAmbient = OriginalLighting.OutdoorAmbient
        Lighting.Brightness = OriginalLighting.Brightness
        Lighting.GlobalShadows = OriginalLighting.GlobalShadows
        Lighting.ClockTime = OriginalLighting.ClockTime
        Lighting.FogEnd = OriginalLighting.FogEnd
        Lighting.FogStart = OriginalLighting.FogStart
        if Camera then Camera.FieldOfView = OriginalCameraFOV end

        chTop.Visible = false
        chBottom.Visible = false
        chLeft.Visible = false
        chRight.Visible = false

        if LocalPlayer.Character then
            local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end
        end
    end)
end

_G.AtomwareFeaturesLoaded = true
print("[Atomware: Rivals] Unified Feature Backend Loaded Successfully!")
return true
