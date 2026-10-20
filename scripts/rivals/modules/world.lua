--[[
    modules/world.lua
    World, Ambience, Lighting & Camera Effects Engine for Atomware (Rivals)
    Includes: Fullbright, Remove Shadows, Clear Fog, Time of Day,
    Custom Camera FOV, Third Person Mode, Bullet Tracers, and Hitmarker Sound
]]

local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local Workspace = game:GetService("Workspace")
local Players = game:GetService("Players")

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
-- Original World State Backup
-- =========================================================================
local OriginalLighting = {
    Ambient = Lighting.Ambient,
    OutdoorAmbient = Lighting.OutdoorAmbient,
    Brightness = Lighting.Brightness,
    GlobalShadows = Lighting.GlobalShadows,
    ClockTime = Lighting.ClockTime,
    FogEnd = Lighting.FogEnd,
    FogStart = Lighting.FogStart,
    FogColor = Lighting.FogColor,
}

local OriginalCameraFOV = Camera.FieldOfView

-- =========================================================================
-- World Settings & State
-- =========================================================================
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

-- Active Tracers Pool
local ActiveTracers = {}

local function createTracer(startPos, endPos, color)
    local line = Drawing.new("Line")
    line.Thickness = 1.5
    line.Transparency = 1
    line.Color = color or WorldState.TracerColor
    line.Visible = false
    trackDrawing(line)

    table.insert(ActiveTracers, {
        Line = line,
        Start = startPos,
        End = endPos,
        Created = os.clock(),
        Duration = 0.6,
    })
end

-- =========================================================================
-- Render Loop (Lighting, FOV, Third Person & Tracers)
-- =========================================================================
track(RunService.RenderStepped:Connect(function()
    -- Fullbright
    if WorldState.Fullbright then
        Lighting.Ambient = Color3.fromRGB(255, 255, 255)
        Lighting.OutdoorAmbient = Color3.fromRGB(255, 255, 255)
        Lighting.Brightness = WorldState.Brightness
    end

    -- Shadows
    if WorldState.NoShadows then
        Lighting.GlobalShadows = false
    end

    -- Clear Fog & Atmosphere
    if WorldState.ClearFog then
        Lighting.FogEnd = 9e9
        Lighting.FogStart = 9e9
        local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
        if atmosphere then
            atmosphere.Density = 0
        end
    end

    -- Time of Day
    if WorldState.CustomTimeOfDay then
        Lighting.ClockTime = WorldState.TimeOfDay
    end

    -- Custom Camera FOV
    if WorldState.CustomFOV then
        Camera.FieldOfView = WorldState.TargetFOV
    end

    -- Third Person Mode
    if WorldState.ThirdPerson and LocalPlayer.Character then
        local root = LocalPlayer.Character:FindFirstChild("HumanoidRootPart") or LocalPlayer.Character:FindFirstChild("Head")
        if root then
            local lookVector = Camera.CFrame.LookVector
            local targetPos = root.Position - (lookVector * WorldState.ThirdPersonDistance) + Vector3.new(0, 1.5, 0)
            Camera.CFrame = CFrame.new(targetPos, targetPos + lookVector)
        end
    end

    -- Update Bullet Tracers
    local now = os.clock()
    for i = #ActiveTracers, 1, -1 do
        local tracer = ActiveTracers[i]
        local elapsed = now - tracer.Created
        if elapsed >= tracer.Duration then
            tracer.Line.Visible = false
            tracer.Line:Remove()
            table.remove(ActiveTracers, i)
        else
            local p1, on1 = Camera:WorldToViewportPoint(tracer.Start)
            local p2, on2 = Camera:WorldToViewportPoint(tracer.End)
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
-- Hitmarker Sound Player
-- =========================================================================
local function playHitSound()
    if not WorldState.HitmarkerSound then return end
    local sound = Instance.new("Sound")
    sound.SoundId = "rbxassetid://6607204501" -- Skeet / crisp bell hit sound
    sound.Volume = 1.5
    sound.Parent = SoundService
    sound:Play()
    sound.Ended:Once(function()
        sound:Destroy()
    end)
end

-- =========================================================================
-- Restore Functions
-- =========================================================================
local function restoreLighting()
    Lighting.Ambient = OriginalLighting.Ambient
    Lighting.OutdoorAmbient = OriginalLighting.OutdoorAmbient
    Lighting.Brightness = OriginalLighting.Brightness
    Lighting.GlobalShadows = OriginalLighting.GlobalShadows
    Lighting.ClockTime = OriginalLighting.ClockTime
    Lighting.FogEnd = OriginalLighting.FogEnd
    Lighting.FogStart = OriginalLighting.FogStart
    Lighting.FogColor = OriginalLighting.FogColor
end

local function restoreCamera()
    Camera.FieldOfView = OriginalCameraFOV
end

-- =========================================================================
-- Event Registrations (Connected to Atomware UI)
-- =========================================================================
if _G.OnToggle then
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
        if not v then restoreCamera() end
    end)

    _G.OnToggle("Third Person", function(v)
        WorldState.ThirdPerson = v
    end)

    _G.OnToggle("Bullet Tracers", function(v)
        WorldState.BulletTracers = v
    end)

    _G.OnToggle("Hitmarker Sound", function(v)
        WorldState.HitmarkerSound = v
    end)
end

if _G.OnSlider then
    _G.OnSlider("Brightness", function(v)
        WorldState.Brightness = v
    end)

    _G.OnSlider("World Time of Day", function(v)
        WorldState.CustomTimeOfDay = true
        WorldState.TimeOfDay = v
        Lighting.ClockTime = v
    end)

    _G.OnSlider("Camera FOV", function(v)
        WorldState.TargetFOV = v
    end)

    _G.OnSlider("Third Person Distance", function(v)
        WorldState.ThirdPersonDistance = v
    end)
end

if _G.OnColorPicker then
    _G.OnColorPicker("Tracer Color", function(v)
        WorldState.TracerColor = v
    end)
end

-- Export module
local WorldModule = {
    State = WorldState,
    CreateTracer = createTracer,
    PlayHitSound = playHitSound,
    Unload = function()
        restoreLighting()
        restoreCamera()
        for _, tracer in ipairs(ActiveTracers) do
            tracer.Line.Visible = false
            tracer.Line:Remove()
        end
        table.clear(ActiveTracers)
    end
}

return WorldModule
