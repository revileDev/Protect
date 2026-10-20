--[[
    modules/combat.lua
    Combat & Targeting Engine for Atomware (Rivals)
    Includes: Silent Aim, Aimbot Assist, Triggerbot, and Hitbox Expander
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local LocalPlayer = Players.LocalPlayer
local Camera = Workspace.CurrentCamera or Workspace:WaitForChild("Camera", 10)

Workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
    if Workspace.CurrentCamera then
        Camera = Workspace.CurrentCamera
    end
end)

local function track(conn)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackConnection then
        return _G.AtomwareCleanup:TrackConnection(conn)
    elseif _G.AtomwareConfig and _G.AtomwareConfig.TrackConnection then
        return _G.AtomwareConfig:TrackConnection(conn)
    end
    return conn
end

local function trackDrawing(drawing)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackDrawing then
        return _G.AtomwareCleanup:TrackDrawing(drawing)
    end
    return drawing
end

-- =========================================================================
-- State & Configuration
-- =========================================================================
local CombatState = {
    -- Silent Aim
    SilentAimEnabled = false,
    SilentTargetPart = "Head",
    SilentHitChance = 100,
    SilentFOV = 120,
    SilentShowFOV = false,
    SilentFOVColor = Color3.fromRGB(205, 104, 255),
    SilentTeamCheck = true,
    SilentWallCheck = false,

    -- Aimbot Assist
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

    -- Triggerbot
    TriggerbotEnabled = false,
    TriggerbotDelay = 50, -- ms
    TriggerbotTeamCheck = true,
    TriggerbotHeadshotOnly = false,
    TriggerbotLastShot = 0,

    -- Hitbox Expander
    HitboxExpanderEnabled = false,
    HitboxSize = 6,
    HitboxPart = "Head",
    HitboxTransparency = 0.5,
}

local OriginalPartSizes = {}

-- =========================================================================
-- FOV Circles
-- =========================================================================
local silentCircle = Drawing.new("Circle")
silentCircle.Thickness = 1.5
silentCircle.NumSides = 64
silentCircle.Filled = false
silentCircle.Transparency = 0.7
silentCircle.Visible = false
trackDrawing(silentCircle)

local aimbotCircle = Drawing.new("Circle")
aimbotCircle.Thickness = 1.5
aimbotCircle.NumSides = 64
aimbotCircle.Filled = false
aimbotCircle.Transparency = 0.7
aimbotCircle.Visible = false
trackDrawing(aimbotCircle)

-- =========================================================================
-- Helpers
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
    if player.Team and LocalPlayer.Team and player.Team == LocalPlayer.Team then
        return true
    end
    if player.TeamColor and LocalPlayer.TeamColor and player.TeamColor == LocalPlayer.TeamColor then
        return true
    end
    return false
end

local function isVisible(targetPart, origin)
    origin = origin or Camera.CFrame.Position
    local ignore = { Camera, LocalPlayer.Character }
    local params = RaycastParams.new()
    params.FilterType = Enum.RaycastFilterType.Exclude
    params.FilterDescendantsInstances = ignore
    params.IgnoreWater = true

    local dir = targetPart.Position - origin
    local hit = Workspace:Raycast(origin, dir, params)
    if not hit then return true end
    return hit.Instance:IsDescendantOf(targetPart.Parent)
end

local function getClosestPlayer(maxFov, partName, checkTeam, checkWall)
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
                        local headPos, hOnScreen = Camera:WorldToViewportPoint(head.Position)
                        local torsoPos, tOnScreen = Camera:WorldToViewportPoint(torso.Position)
                        if hOnScreen and tOnScreen then
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
                    local screenPos, onScreen = Camera:WorldToViewportPoint(part.Position)
                    if onScreen then
                        local dist = (Vector2.new(screenPos.X, screenPos.Y) - mousePos).Magnitude
                        if dist < minDistance then
                            if not checkWall or isVisible(part) then
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

-- =========================================================================
-- Render Loop (Aimbot & FOV Circles)
-- =========================================================================
track(RunService.RenderStepped:Connect(function()
    local mousePos = UserInputService:GetMouseLocation()

    -- Update FOV Circles
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

    -- Run Aimbot Assist
    if CombatState.AimbotEnabled and CombatState.AimbotActive then
        local _, targetPart = getClosestPlayer(
            CombatState.AimbotFOV,
            CombatState.AimbotTargetPart,
            CombatState.AimbotTeamCheck,
            CombatState.AimbotWallCheck
        )
        if targetPart then
            local targetPos = targetPart.Position
            local camPos = Camera.CFrame.Position
            local targetCFrame = CFrame.new(camPos, targetPos)
            local smooth = math.clamp(1 / math.max(1, CombatState.AimbotSmoothness), 0.05, 1)
            Camera.CFrame = Camera.CFrame:Lerp(targetCFrame, smooth)
        end
    end
end))

-- =========================================================================
-- Triggerbot Heartbeat Loop
-- =========================================================================
track(RunService.Heartbeat:Connect(function()
    if not CombatState.TriggerbotEnabled then return end
    local now = os.clock() * 1000
    if now - CombatState.TriggerbotLastShot < CombatState.TriggerbotDelay then return end

    local mousePos = UserInputService:GetMouseLocation()
    local unitRay = Camera:ViewportPointToRay(mousePos.X, mousePos.Y)
    local params = RaycastParams.new()
    params.FilterType = Enum.RaycastFilterType.Exclude
    params.FilterDescendantsInstances = { Camera, LocalPlayer.Character }
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

-- =========================================================================
-- Hitbox Expander Loop
-- =========================================================================
track(RunService.Heartbeat:Connect(function()
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

-- =========================================================================
-- Input Listener for Aimbot Activation
-- =========================================================================
local function isInputMatching(input, bindName)
    if not bindName or bindName == "None" then return false end
    if input.UserInputType == Enum.UserInputType.MouseButton1 and bindName == "MouseButton1" then return true end
    if input.UserInputType == Enum.UserInputType.MouseButton2 and bindName == "MouseButton2" then return true end
    if input.UserInputType == Enum.UserInputType.Keyboard and input.KeyCode.Name == bindName then return true end
    return false
end

track(UserInputService.InputBegan:Connect(function(input, gpe)
    if gpe then return end
    if isInputMatching(input, CombatState.AimbotKey) then
        CombatState.AimbotActive = true
    end
end))

track(UserInputService.InputEnded:Connect(function(input)
    if isInputMatching(input, CombatState.AimbotKey) then
        CombatState.AimbotActive = false
    end
end))

-- =========================================================================
-- Event Registrations (Connected to Atomware UI)
-- =========================================================================
if _G.OnToggle then
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
end

if _G.OnSlider then
    _G.OnSlider("Silent Aim Hit Chance", function(v) CombatState.SilentHitChance = v end)
    _G.OnSlider("Silent Aim FOV", function(v) CombatState.SilentFOV = v end)

    _G.OnSlider("Aimbot Smoothness", function(v) CombatState.AimbotSmoothness = v end)
    _G.OnSlider("Aimbot FOV", function(v) CombatState.AimbotFOV = v end)

    _G.OnSlider("Triggerbot Delay", function(v) CombatState.TriggerbotDelay = v end)

    _G.OnSlider("Hitbox Size", function(v) CombatState.HitboxSize = v end)
    _G.OnSlider("Hitbox Transparency", function(v) CombatState.HitboxTransparency = v / 100 end)
end

if _G.OnDropdown then
    _G.OnDropdown("Silent Target Part", function(v) CombatState.SilentTargetPart = v end)
    _G.OnDropdown("Aimbot Target Part", function(v) CombatState.AimbotTargetPart = v end)
    _G.OnDropdown("Hitbox Part", function(v)
        restoreHitboxes()
        CombatState.HitboxPart = v
    end)
end

if _G.OnColorPicker then
    _G.OnColorPicker("Silent FOV Color", function(v) CombatState.SilentFOVColor = v end)
    _G.OnColorPicker("Aimbot FOV Color", function(v) CombatState.AimbotFOVColor = v end)
end

if _G.OnKeybind then
    _G.OnKeybind("Aimbot Key", function(v) CombatState.AimbotKey = v end)
end

-- Export module
local CombatModule = {
    State = CombatState,
    GetClosestTarget = function()
        return getClosestPlayer(
            CombatState.SilentFOV,
            CombatState.SilentTargetPart,
            CombatState.SilentTeamCheck,
            CombatState.SilentWallCheck
        )
    end,
    Unload = function()
        restoreHitboxes()
        silentCircle.Visible = false
        aimbotCircle.Visible = false
    end
}

return CombatModule
