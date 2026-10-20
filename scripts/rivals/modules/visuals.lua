--[[
    modules/visuals.lua
    High-Performance Visuals & ESP Engine for Atomware (Rivals)
    Includes: 2D Box, Box Fill, Health Bar, Name, Distance, Weapon, Skeleton,
    Snaplines, Head Dot, Off-Screen Arrows, and Chams / Highlights
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
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

local function trackInstance(inst)
    if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackInstance then
        return _G.AtomwareCleanup:TrackInstance(inst)
    end
    return inst
end

-- =========================================================================
-- Visuals Settings & State
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

    -- Styling
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

-- Cache of drawing objects per player
local ESPCache = {}
local HighlightCache = {}

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

local function createPlayerESP(player)
    local esp = {
        BoxOutline = trackDrawing(Drawing.new("Square")),
        Box = trackDrawing(Drawing.new("Square")),
        BoxFill = trackDrawing(Drawing.new("Square")),
        HealthBarBg = trackDrawing(Drawing.new("Square")),
        HealthBar = trackDrawing(Drawing.new("Square")),
        Name = trackDrawing(Drawing.new("Text")),
        Distance = trackDrawing(Drawing.new("Text")),
        Weapon = trackDrawing(Drawing.new("Text")),
        Snapline = trackDrawing(Drawing.new("Line")),
        HeadDot = trackDrawing(Drawing.new("Circle")),
        OffscreenArrow = trackDrawing(Drawing.new("Triangle")),
        SkeletonLines = {},
    }

    -- Init Box
    esp.BoxOutline.Thickness = 3
    esp.BoxOutline.Filled = false
    esp.BoxOutline.Color = Color3.fromRGB(0, 0, 0)
    esp.BoxOutline.Transparency = 1
    esp.BoxOutline.Visible = false

    esp.Box.Thickness = 1
    esp.Box.Filled = false
    esp.Box.Transparency = 1
    esp.Box.Visible = false

    esp.BoxFill.Filled = true
    esp.BoxFill.Thickness = 0
    esp.BoxFill.Visible = false

    -- Init Health Bar
    esp.HealthBarBg.Thickness = 1
    esp.HealthBarBg.Filled = true
    esp.HealthBarBg.Color = Color3.fromRGB(15, 10, 20)
    esp.HealthBarBg.Transparency = 0.8
    esp.HealthBarBg.Visible = false

    esp.HealthBar.Thickness = 1
    esp.HealthBar.Filled = true
    esp.HealthBar.Visible = false

    -- Init Texts
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

    -- Init Snapline
    esp.Snapline.Thickness = 1
    esp.Snapline.Visible = false

    -- Init Head Dot
    esp.HeadDot.Thickness = 1
    esp.HeadDot.Filled = true
    esp.HeadDot.NumSides = 16
    esp.HeadDot.Visible = false

    -- Init Offscreen Arrow
    esp.OffscreenArrow.Filled = true
    esp.OffscreenArrow.Thickness = 1
    esp.OffscreenArrow.Visible = false

    -- 14 Skeleton Lines for R15 / R6
    for i = 1, 14 do
        local line = trackDrawing(Drawing.new("Line"))
        line.Thickness = 1.5
        line.Visible = false
        table.insert(esp.SkeletonLines, line)
    end

    ESPCache[player] = esp
    return esp
end

local function removePlayerESP(player)
    local esp = ESPCache[player]
    if esp then
        for _, key in ipairs({ "BoxOutline", "Box", "BoxFill", "HealthBarBg", "HealthBar", "Name", "Distance", "Weapon", "Snapline", "HeadDot", "OffscreenArrow" }) do
            if esp[key] then
                pcall(function() esp[key].Visible = false; esp[key]:Remove() end)
            end
        end
        for _, line in ipairs(esp.SkeletonLines or {}) do
            pcall(function() line.Visible = false; line:Remove() end)
        end
        ESPCache[player] = nil
    end

    local highlight = HighlightCache[player]
    if highlight then
        pcall(function() highlight:Destroy() end)
        HighlightCache[player] = nil
    end
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
    for _, l in ipairs(esp.SkeletonLines) do
        l.Visible = false
    end
end

-- =========================================================================
-- Skeleton Bone Connections
-- =========================================================================
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

-- =========================================================================
-- RenderStepped Main Loop
-- =========================================================================
track(RunService.RenderStepped:Connect(function()
    if not VisualsState.Enabled then
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        for _, hl in pairs(HighlightCache) do hl.Enabled = false end
        return
    end

    local vp = Camera.ViewportSize
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

        local dist = (root.Position - Camera.CFrame.Position).Magnitude
        if dist > VisualsState.MaxDistance then
            hideAllESP(esp)
            if HighlightCache[player] then HighlightCache[player].Enabled = false end
            continue
        end

        -- Check if on screen
        local rootPos, onScreen = Camera:WorldToViewportPoint(root.Position)
        local headPos = Camera:WorldToViewportPoint(head.Position + Vector3.new(0, 0.5, 0))
        local legPos = Camera:WorldToViewportPoint(root.Position - Vector3.new(0, 3, 0))

        -- Highlight / Chams
        if VisualsState.Chams then
            local hl = HighlightCache[player]
            if not hl or not hl.Parent then
                hl = trackInstance(Instance.new("Highlight"))
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

            -- Calculate 2D Bounding Box
            local height = math.abs(headPos.Y - legPos.Y)
            local width = height * 0.6
            local boxX = rootPos.X - width / 2
            local boxY = headPos.Y

            -- Box ESP
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

            -- Box Fill
            if VisualsState.BoxFill then
                esp.BoxFill.Visible = true
                esp.BoxFill.Position = Vector2.new(boxX, boxY)
                esp.BoxFill.Size = Vector2.new(width, height)
                esp.BoxFill.Color = VisualsState.BoxFillColor
                esp.BoxFill.Transparency = VisualsState.BoxFillTransparency
            else
                esp.BoxFill.Visible = false
            end

            -- Health Bar
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

            -- Name ESP
            if VisualsState.Name then
                esp.Name.Visible = true
                esp.Name.Text = player.DisplayName or player.Name
                esp.Name.Position = Vector2.new(rootPos.X, boxY - 14)
                esp.Name.Color = VisualsState.TextColor
            else
                esp.Name.Visible = false
            end

            -- Distance ESP
            if VisualsState.Distance then
                esp.Distance.Visible = true
                esp.Distance.Text = tostring(math.floor(dist * 0.28)) .. "m"
                esp.Distance.Position = Vector2.new(rootPos.X, boxY + height + 2)
                esp.Distance.Color = VisualsState.TextColor
            else
                esp.Distance.Visible = false
            end

            -- Weapon ESP
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

            -- Snaplines
            if VisualsState.Snaplines then
                local originY = vp.Y
                if VisualsState.SnaplineOrigin == "Center" then
                    originY = vp.Y / 2
                elseif VisualsState.SnaplineOrigin == "Top" then
                    originY = 0
                end
                esp.Snapline.Visible = true
                esp.Snapline.From = Vector2.new(vp.X / 2, originY)
                esp.Snapline.To = Vector2.new(rootPos.X, legPos.Y)
                esp.Snapline.Color = VisualsState.SnaplineColor
            else
                esp.Snapline.Visible = false
            end

            -- Head Dot
            if VisualsState.HeadDot then
                local hDotPos, hOnScreen = Camera:WorldToViewportPoint(head.Position)
                if hOnScreen then
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

            -- Skeleton ESP
            if VisualsState.Skeleton then
                local lineIndex = 1
                for _, bone in ipairs(SKELETON_BONES) do
                    local p1 = char:FindFirstChild(bone[1])
                    local p2 = char:FindFirstChild(bone[2])
                    local line = esp.SkeletonLines[lineIndex]
                    if p1 and p2 and line then
                        local pos1, on1 = Camera:WorldToViewportPoint(p1.Position)
                        local pos2, on2 = Camera:WorldToViewportPoint(p2.Position)
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
            -- Off-Screen Target
            hideAllESP(esp)
            if VisualsState.OffscreenArrows then
                local camCFrame = Camera.CFrame
                local relPos = camCFrame:PointToObjectSpace(root.Position)
                local angle = math.atan2(-relPos.X, relPos.Z)
                local rad = VisualsState.OffscreenRadius
                local arrowCenter = screenCenter + Vector2.new(math.sin(angle) * rad, -math.cos(angle) * rad)

                local p1 = arrowCenter + Vector2.new(math.sin(angle) * 12, -math.cos(angle) * 12)
                local p2 = arrowCenter + Vector2.new(math.sin(angle + 2.5) * 8, -math.cos(angle + 2.5) * 8)
                local p3 = arrowCenter + Vector2.new(math.sin(angle - 2.5) * 8, -math.cos(angle - 2.5) * 8)

                esp.OffscreenArrow.Visible = true
                esp.OffscreenArrow.PointA = p1
                esp.OffscreenArrow.PointB = p2
                esp.OffscreenArrow.PointC = p3
                esp.OffscreenArrow.Color = VisualsState.OffscreenColor
            else
                esp.OffscreenArrow.Visible = false
            end
        end
    end
end))

track(Players.PlayerRemoving:Connect(removePlayerESP))

-- =========================================================================
-- Event Registrations (Connected to Atomware UI)
-- =========================================================================
if _G.OnToggle then
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
end

if _G.OnSlider then
    _G.OnSlider("Max ESP Distance", function(v) VisualsState.MaxDistance = v end)
    _G.OnSlider("Box Fill Transparency", function(v) VisualsState.BoxFillTransparency = v / 100 end)
    _G.OnSlider("Head Dot Size", function(v) VisualsState.HeadDotSize = v end)
    _G.OnSlider("Off-Screen Radius", function(v) VisualsState.OffscreenRadius = v end)
end

if _G.OnDropdown then
    _G.OnDropdown("Snapline Origin", function(v) VisualsState.SnaplineOrigin = v end)
end

if _G.OnColorPicker then
    _G.OnColorPicker("Box Color", function(v) VisualsState.BoxColor = v end)
    _G.OnColorPicker("Box Fill Color", function(v) VisualsState.BoxFillColor = v end)
    _G.OnColorPicker("Skeleton Color", function(v) VisualsState.SkeletonColor = v end)
    _G.OnColorPicker("Text Color", function(v) VisualsState.TextColor = v end)
    _G.OnColorPicker("Snapline Color", function(v) VisualsState.SnaplineColor = v end)
    _G.OnColorPicker("Head Dot Color", function(v) VisualsState.HeadDotColor = v end)
    _G.OnColorPicker("Off-Screen Color", function(v) VisualsState.OffscreenColor = v end)
    _G.OnColorPicker("Chams Fill Color", function(v) VisualsState.ChamsFillColor = v end)
    _G.OnColorPicker("Chams Outline Color", function(v) VisualsState.ChamsOutlineColor = v end)
end

-- Export module
local VisualsModule = {
    State = VisualsState,
    Unload = function()
        for _, esp in pairs(ESPCache) do hideAllESP(esp) end
        for _, hl in pairs(HighlightCache) do hl:Destroy() end
        table.clear(ESPCache)
        table.clear(HighlightCache)
    end
}

return VisualsModule
