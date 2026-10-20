--[[
    modules/player.lua
    Movement, Physics, Flight & Player Utilities Engine for Atomware (Rivals)
    Includes: Speed Multiplier, Infinite Jump, Bunny Hop, Fly, Noclip,
    Spinbot / Anti-Aim, and Custom Crosshair Overlay
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local LocalPlayer = Players.LocalPlayer
local Camera = Workspace.CurrentCamera or Workspace:WaitForChild("Camera", 10)

Workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
    if Workspace.CurrentCamera then Camera = Workspace.CurrentCamera end
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
-- Player Settings & State
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

-- Crosshair Drawings
local chTop = trackDrawing(Drawing.new("Line"))
local chBottom = trackDrawing(Drawing.new("Line"))
local chLeft = trackDrawing(Drawing.new("Line"))
local chRight = trackDrawing(Drawing.new("Line"))

for _, line in ipairs({ chTop, chBottom, chLeft, chRight }) do
    line.Thickness = 1.5
    line.Visible = false
end

-- =========================================================================
-- Movement & Physics Loop (RenderStepped & Stepped)
-- =========================================================================
track(RunService.RenderStepped:Connect(function()
    local char = LocalPlayer.Character
    if not char then return end
    local hum = char:FindFirstChildOfClass("Humanoid")
    local root = char:FindFirstChild("HumanoidRootPart")

    -- Speed Hack
    if PlayerState.SpeedEnabled and hum then
        hum.WalkSpeed = PlayerState.WalkSpeed
    end

    -- Bunny Hop
    if PlayerState.BunnyHop and hum and root then
        if hum.MoveDirection.Magnitude > 0 and hum.FloorMaterial ~= Enum.Material.Air then
            hum:ChangeState(Enum.HumanoidStateType.Jumping)
        end
    end

    -- Spinbot / Anti-Aim
    if PlayerState.Spinbot and root then
        root.CFrame = root.CFrame * CFrame.Angles(0, math.rad(PlayerState.SpinSpeed), 0)
    end

    -- Crosshair Overlay
    if PlayerState.Crosshair then
        local vp = Camera.ViewportSize
        local cx = vp.X / 2
        local cy = vp.Y / 2
        local sz = PlayerState.CrosshairSize
        local gap = PlayerState.CrosshairGap
        local col = PlayerState.CrosshairColor

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

-- Noclip Stepped Loop
track(RunService.Stepped:Connect(function()
    if not PlayerState.Noclip then return end
    local char = LocalPlayer.Character
    if not char then return end
    for _, part in ipairs(char:GetDescendants()) do
        if part:IsA("BasePart") and part.CanCollide then
            part.CanCollide = false
        end
    end
end))

-- Fly Loop (Heartbeat)
track(RunService.Heartbeat:Connect(function(dt)
    if not PlayerState.FlyEnabled then return end
    local char = LocalPlayer.Character
    if not char then return end
    local root = char:FindFirstChild("HumanoidRootPart")
    local hum = char:FindFirstChildOfClass("Humanoid")
    if not root or not hum then return end

    local moveDir = hum.MoveDirection
    local camCF = Camera.CFrame
    local flyVec = Vector3.zero

    if moveDir.Magnitude > 0 then
        -- Project movement into camera direction
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

-- Infinite Jump Request
track(UserInputService.JumpRequest:Connect(function()
    if PlayerState.InfiniteJump and LocalPlayer.Character then
        local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
        if hum then
            hum:ChangeState(Enum.HumanoidStateType.Jumping)
        end
    end
end))

-- =========================================================================
-- Event Registrations (Connected to Atomware UI)
-- =========================================================================
if _G.OnToggle then
    _G.OnToggle("Speed Multiplier", function(v)
        PlayerState.SpeedEnabled = v
        if not v and LocalPlayer.Character then
            local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end
        end
    end)

    _G.OnToggle("Infinite Jump", function(v)
        PlayerState.InfiniteJump = v
    end)

    _G.OnToggle("Bunny Hop", function(v)
        PlayerState.BunnyHop = v
    end)

    _G.OnToggle("Fly", function(v)
        PlayerState.FlyEnabled = v
    end)

    _G.OnToggle("Noclip", function(v)
        PlayerState.Noclip = v
    end)

    _G.OnToggle("Spinbot / Anti-Aim", function(v)
        PlayerState.Spinbot = v
    end)

    _G.OnToggle("Crosshair Overlay", function(v)
        PlayerState.Crosshair = v
    end)
end

if _G.OnSlider then
    _G.OnSlider("WalkSpeed", function(v)
        PlayerState.WalkSpeed = v
    end)

    _G.OnSlider("Fly Speed", function(v)
        PlayerState.FlySpeed = v
    end)

    _G.OnSlider("Spin Speed", function(v)
        PlayerState.SpinSpeed = v
    end)
end

-- Export module
local PlayerModule = {
    State = PlayerState,
    Unload = function()
        chTop.Visible = false
        chBottom.Visible = false
        chLeft.Visible = false
        chRight.Visible = false
        if LocalPlayer.Character then
            local hum = LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end
        end
    end
}

return PlayerModule
