--[[
    Atomware Mobile UI (mobile_ui.lua)
    Ultra-Polished Mobile & Touch Framework for Atomware (Rivals)
    Features Floating Draggable Toggle with Lock, Two-Column Touch Cards,
    and Responsive Controls
]]

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local CoreGui = game:GetService("CoreGui")

local LocalPlayer = Players.LocalPlayer

local function trackConnection(connection)
    if _G.AtomwareConfig then return _G.AtomwareConfig:TrackConnection(connection) end
    if _G.AtomwareCleanup then return _G.AtomwareCleanup:TrackConnection(connection) end
    return connection
end

--//==================================================
--// GLOBAL EVENT BINDING SYSTEM
--//==================================================

_G.AtomwareEvents = _G.AtomwareEvents or {}
_G.AtomwarePendingEvents = {}

local function registerAtomwareEvent(name, callback)
    _G.AtomwareEvents[name] = callback
    local pending = _G.AtomwarePendingEvents[name]
    if pending then
        _G.AtomwarePendingEvents[name] = nil
        task.spawn(function()
            local ok, err = pcall(callback, table.unpack(pending, 1, pending.n))
            if not ok then warn("Atomware: event '" .. name .. "' failed: " .. tostring(err)) end
        end)
    end
end

_G.OnToggle = function(name, callback) registerAtomwareEvent(name, callback) end
_G.OnSlider = function(name, callback) registerAtomwareEvent(name, callback) end
_G.OnDropdown = function(name, callback) registerAtomwareEvent(name, callback) end
_G.OnColorPicker = function(name, callback) registerAtomwareEvent(name, callback) end
_G.OnKeybind = function(name, callback) registerAtomwareEvent(name, callback) end

_G.FireEvent = function(name, ...)
    if _G.AtomwareConfig and select("#", ...) == 1 then
        _G.AtomwareConfig:Store(name, (...))
    end
    local callback = _G.AtomwareEvents[name]
    if callback then
        local args = { ... }
        local count = select("#", ...)
        task.spawn(function()
            local ok, err = pcall(callback, table.unpack(args, 1, count))
            if not ok then warn("Atomware: event '" .. name .. "' failed: " .. tostring(err)) end
        end)
        return
    end
    local args = { ... }
    args.n = select("#", ...)
    _G.AtomwarePendingEvents[name] = args
end

local function bindSetting(name, default, apply, validate)
    if _G.AtomwareConfig then return _G.AtomwareConfig:Register(name, default, apply, validate) end
    return default
end

--//==================================================
--// MOBILE THEME & STYLING
--//==================================================

local THEME = {
    Background      = Color3.fromRGB(8, 6, 15),
    Header          = Color3.fromRGB(13, 9, 24),
    Card            = Color3.fromRGB(16, 11, 30),
    CardAlt         = Color3.fromRGB(24, 16, 44),
    CardHover       = Color3.fromRGB(32, 20, 56),

    Border          = Color3.fromRGB(105, 45, 195),
    BorderDim       = Color3.fromRGB(55, 30, 95),
    Accent          = Color3.fromRGB(157, 48, 255),
    AccentBright    = Color3.fromRGB(205, 104, 255),
    AccentDark      = Color3.fromRGB(80, 26, 142),

    Text            = Color3.fromRGB(245, 241, 255),
    TextMuted       = Color3.fromRGB(170, 155, 205),
    Red             = Color3.fromRGB(255, 75, 100),
}

local FONT = Enum.Font.GothamMedium
local FONT_BOLD = Enum.Font.GothamBold

local function corner(instance, radius)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, radius)
    c.Parent = instance
    return c
end

local function stroke(instance, color, thickness)
    local s = Instance.new("UIStroke")
    s.Color = color
    s.Thickness = thickness or 1
    s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    s.Parent = instance
    return s
end

local function padding(instance, l, r, t, b)
    local p = Instance.new("UIPadding")
    p.PaddingLeft = UDim.new(0, l or 0)
    p.PaddingRight = UDim.new(0, r or 0)
    p.PaddingTop = UDim.new(0, t or 0)
    p.PaddingBottom = UDim.new(0, b or 0)
    p.Parent = instance
    return p
end

local function tween(instance, info, properties)
    local tw = TweenService:Create(instance, info, properties)
    tw:Play()
    return tw
end

--//==================================================
--// ROOT SCREEN GUI
--//==================================================

local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "AtomwareMobileUI"
ScreenGui.ResetOnSpawn = false
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

if type(gethui) == "function" then
    ScreenGui.Parent = gethui()
elseif type(syn) == "table" and type(syn.protect_gui) == "function" then
    syn.protect_gui(ScreenGui)
    ScreenGui.Parent = CoreGui
else
    pcall(function() ScreenGui.Parent = CoreGui end)
    if not ScreenGui.Parent then ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui") end
end

if _G.AtomwareCleanup and _G.AtomwareCleanup.TrackInstance then
    _G.AtomwareCleanup:TrackInstance(ScreenGui)
end

if _G.AtomwareConfig then
    _G.AtomwareConfig:AttachUI(ScreenGui, "Mobile")
end

--//==================================================
--// MAIN WINDOW CONTAINER
--//==================================================

local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.AnchorPoint = Vector2.new(0.5, 0.5)
MainFrame.Position = UDim2.fromScale(0.5, 0.5)
MainFrame.Size = UDim2.new(0.96, 0, 0.90, 0)
MainFrame.BackgroundColor3 = THEME.Background
MainFrame.BorderSizePixel = 0
MainFrame.ClipsDescendants = true
MainFrame.Parent = ScreenGui
corner(MainFrame, 12)
stroke(MainFrame, THEME.Border, 1.5)

local isUILocked = false
local UIVisible = true

local function setUIVisible(state)
    if state and isUILocked then return end
    UIVisible = state
    if state then
        MainFrame.Visible = true
        tween(MainFrame, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
            Size = UDim2.new(0.96, 0, 0.90, 0)
        })
    else
        tween(MainFrame, TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
            Size = UDim2.fromOffset(0, 0)
        }).Completed:Once(function()
            if not UIVisible then MainFrame.Visible = false end
        end)
    end
end

--//==================================================
--// DRAGGABLE MOBILE TOGGLE CONTAINER WITH LOCK
--//==================================================

local ToggleContainer = Instance.new("Frame")
ToggleContainer.Name = "AtomwareMobileToggleContainer"
ToggleContainer.Size = UDim2.fromOffset(126, 52)
ToggleContainer.Position = UDim2.new(1, -138, 1, -130)
ToggleContainer.BackgroundTransparency = 1
ToggleContainer.BorderSizePixel = 0
ToggleContainer.Parent = ScreenGui
ToggleContainer.ZIndex = 200

local isDraggingToggle = false
local toggleDragStart = nil
local toggleStartPos = nil
local toggleHasDragged = false
local toggleDragInput = nil

local function updateToggleDrag(input)
    if not isDraggingToggle or isUILocked then return end
    local delta = input.Position - toggleDragStart
    if delta.Magnitude > 6 then
        toggleHasDragged = true
    end
    local camera = workspace.CurrentCamera
    local vp = camera and camera.ViewportSize or Vector2.new(800, 600)
    local maxX = math.max(0, vp.X - ToggleContainer.AbsoluteSize.X)
    local maxY = math.max(0, vp.Y - ToggleContainer.AbsoluteSize.Y)
    local newX = math.clamp(toggleStartPos.X.Offset + delta.X, 0, maxX)
    local newY = math.clamp(toggleStartPos.Y.Offset + delta.Y, 0, maxY)
    ToggleContainer.Position = UDim2.fromOffset(newX, newY)
end

local MobileToggleBtn = Instance.new("TextButton")
MobileToggleBtn.Name = "MobileToggle"
MobileToggleBtn.Size = UDim2.fromOffset(52, 52)
MobileToggleBtn.Position = UDim2.fromOffset(0, 0)
MobileToggleBtn.BackgroundColor3 = THEME.Header
MobileToggleBtn.Text = "A"
MobileToggleBtn.TextColor3 = THEME.AccentBright
MobileToggleBtn.TextSize = 22
MobileToggleBtn.Font = FONT_BOLD
MobileToggleBtn.AutoButtonColor = false
MobileToggleBtn.ZIndex = 201
MobileToggleBtn.Parent = ToggleContainer
corner(MobileToggleBtn, 16)
stroke(MobileToggleBtn, THEME.Accent, 1.5)

local ToggleLockBtn = Instance.new("TextButton")
ToggleLockBtn.Name = "MobileToggleLock"
ToggleLockBtn.Size = UDim2.fromOffset(66, 38)
ToggleLockBtn.Position = UDim2.fromOffset(58, 7)
ToggleLockBtn.BackgroundColor3 = THEME.Header
ToggleLockBtn.Text = "Lock"
ToggleLockBtn.TextColor3 = THEME.TextMuted
ToggleLockBtn.TextSize = 12
ToggleLockBtn.Font = FONT_BOLD
ToggleLockBtn.AutoButtonColor = false
ToggleLockBtn.ZIndex = 201
ToggleLockBtn.Parent = ToggleContainer
corner(ToggleLockBtn, 10)
local lockStroke = stroke(ToggleLockBtn, THEME.Border, 1)

local function onToggleDragInputBegan(input)
    if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
        if not isUILocked then
            isDraggingToggle = true
            toggleHasDragged = false
            toggleDragStart = input.Position
            toggleStartPos = ToggleContainer.Position
            toggleDragInput = input
        end
    end
end

trackConnection(MobileToggleBtn.InputBegan:Connect(onToggleDragInputBegan))
trackConnection(ToggleContainer.InputBegan:Connect(onToggleDragInputBegan))

trackConnection(UserInputService.InputChanged:Connect(function(input)
    if isDraggingToggle and (input == toggleDragInput or input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseMovement) then
        updateToggleDrag(input)
    end
end))

trackConnection(UserInputService.InputEnded:Connect(function(input)
    if input == toggleDragInput or input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDraggingToggle = false
        toggleDragInput = nil
    end
end))

trackConnection(MobileToggleBtn.MouseButton1Click:Connect(function()
    if toggleHasDragged then
        toggleHasDragged = false
        return
    end
    if isUILocked then
        if _G.AtomwareConfig and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("UI is Locked! Press 'Lock' to unlock.", 2)
        end
        return
    end
    setUIVisible(not UIVisible)
end))

trackConnection(ToggleLockBtn.MouseButton1Click:Connect(function()
    isUILocked = not isUILocked
    if isUILocked then
        if UIVisible then setUIVisible(false) end
        ToggleLockBtn.Text = "Locked"
        ToggleLockBtn.TextColor3 = THEME.Red
        ToggleLockBtn.BackgroundColor3 = Color3.fromRGB(60, 20, 28)
        lockStroke.Color = THEME.Red
    else
        ToggleLockBtn.Text = "Lock"
        ToggleLockBtn.TextColor3 = THEME.TextMuted
        ToggleLockBtn.BackgroundColor3 = THEME.Header
        lockStroke.Color = THEME.Border
    end
end))

--//==================================================
--// HEADER & NAVIGATION
--//==================================================

local Header = Instance.new("Frame")
Header.Name = "Header"
Header.Size = UDim2.new(1, 0, 0, 46)
Header.BackgroundColor3 = THEME.Header
Header.BorderSizePixel = 0
Header.Parent = MainFrame
stroke(Header, THEME.BorderDim, 1)

local HeaderAccent = Instance.new("Frame")
HeaderAccent.Size = UDim2.fromOffset(4, 24)
HeaderAccent.Position = UDim2.fromOffset(12, 11)
HeaderAccent.BackgroundColor3 = THEME.Accent
HeaderAccent.BorderSizePixel = 0
HeaderAccent.Parent = Header
corner(HeaderAccent, 2)

local Title = Instance.new("TextLabel")
Title.BackgroundTransparency = 1
Title.Text = "atomware  <font color=\"#cd68ff\">v2</font>  <font color=\"#a091c3\">•  rivals</font>"
Title.RichText = true
Title.Size = UDim2.new(0.6, 0, 1, 0)
Title.Position = UDim2.fromOffset(24, 0)
Title.TextSize = 16
Title.TextColor3 = THEME.Text
Title.Font = FONT_BOLD
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.Parent = Header

local CloseBtn = Instance.new("TextButton")
CloseBtn.Size = UDim2.fromOffset(34, 28)
CloseBtn.Position = UDim2.new(1, -42, 0, 9)
CloseBtn.BackgroundColor3 = THEME.Card
CloseBtn.Text = "✕"
CloseBtn.TextColor3 = THEME.Red
CloseBtn.TextSize = 13
CloseBtn.Font = FONT_BOLD
CloseBtn.AutoButtonColor = false
CloseBtn.Parent = Header
corner(CloseBtn, 6)
stroke(CloseBtn, THEME.BorderDim, 1)
trackConnection(CloseBtn.MouseButton1Click:Connect(function() setUIVisible(false) end))

-- TabBar
local TabBar = Instance.new("ScrollingFrame")
TabBar.Name = "TabBar"
TabBar.Size = UDim2.new(1, 0, 0, 42)
TabBar.Position = UDim2.fromOffset(0, 46)
TabBar.BackgroundColor3 = THEME.Header
TabBar.BorderSizePixel = 0
TabBar.ScrollBarThickness = 0
TabBar.AutomaticCanvasSize = Enum.AutomaticSize.X
TabBar.Parent = MainFrame
padding(TabBar, 8, 8, 4, 4)

local TabListLayout = Instance.new("UIListLayout")
TabListLayout.FillDirection = Enum.FillDirection.Horizontal
TabListLayout.VerticalAlignment = Enum.VerticalAlignment.Center
TabListLayout.Padding = UDim.new(0, 6)
TabListLayout.Parent = TabBar

-- Content Area
local ContentArea = Instance.new("Frame")
ContentArea.Name = "ContentArea"
ContentArea.BackgroundTransparency = 1
ContentArea.Position = UDim2.fromOffset(0, 88)
ContentArea.Size = UDim2.new(1, 0, 1, -88)
ContentArea.Parent = MainFrame

local Pages = {}
local TabButtons = {}
local CurrentPageName = "Combat"

local function createPage(name)
    local page = Instance.new("ScrollingFrame")
    page.Name = name
    page.BackgroundTransparency = 1
    page.BorderSizePixel = 0
    page.Size = UDim2.new(1, 0, 1, 0)
    page.AutomaticCanvasSize = Enum.AutomaticSize.Y
    page.ScrollBarThickness = 3
    page.ScrollBarImageColor3 = THEME.Accent
    page.Visible = false
    page.Parent = ContentArea
    padding(page, 8, 8, 8, 16)

    local colContainer = Instance.new("Frame")
    colContainer.Name = "ColContainer"
    colContainer.BackgroundTransparency = 1
    colContainer.Size = UDim2.new(1, 0, 0, 0)
    colContainer.AutomaticSize = Enum.AutomaticSize.Y
    colContainer.Parent = page

    local hList = Instance.new("UIListLayout")
    hList.FillDirection = Enum.FillDirection.Horizontal
    hList.VerticalAlignment = Enum.VerticalAlignment.Top
    hList.Padding = UDim.new(0, 8)
    hList.Parent = colContainer

    local leftCol = Instance.new("Frame")
    leftCol.Name = "LeftCol"
    leftCol.BackgroundTransparency = 1
    leftCol.Size = UDim2.new(0.5, -4, 0, 0)
    leftCol.AutomaticSize = Enum.AutomaticSize.Y
    leftCol.Parent = colContainer

    local leftList = Instance.new("UIListLayout")
    leftList.Padding = UDim.new(0, 8)
    leftList.Parent = leftCol

    local rightCol = Instance.new("Frame")
    rightCol.Name = "RightCol"
    rightCol.BackgroundTransparency = 1
    rightCol.Size = UDim2.new(0.5, -4, 0, 0)
    rightCol.AutomaticSize = Enum.AutomaticSize.Y
    rightCol.Parent = colContainer

    local rightList = Instance.new("UIListLayout")
    rightList.Padding = UDim.new(0, 8)
    rightList.Parent = rightCol

    Pages[name] = { Page = page, Left = leftCol, Right = rightCol, Count = 0 }
    return page
end

local function switchPage(name)
    CurrentPageName = name
    for pName, pData in pairs(Pages) do
        pData.Page.Visible = (pName == name)
    end
    for pName, btn in pairs(TabButtons) do
        local active = (pName == name)
        tween(btn, TweenInfo.new(0.15), {
            BackgroundColor3 = active and THEME.AccentDark or THEME.Card,
            TextColor3 = active and THEME.AccentBright or THEME.TextMuted
        })
    end
end

--//==================================================
--// MOBILE WIDGET BUILDERS
--//==================================================

local function createCard(pageName, title)
    local pageData = Pages[pageName]
    local targetCol = (pageData.Count % 2 == 0) and pageData.Left or pageData.Right
    pageData.Count = pageData.Count + 1

    local card = Instance.new("Frame")
    card.Name = title .. "Card"
    card.BackgroundColor3 = THEME.Card
    card.Size = UDim2.new(1, 0, 0, 0)
    card.AutomaticSize = Enum.AutomaticSize.Y
    card.Parent = targetCol
    corner(card, 8)
    stroke(card, THEME.BorderDim, 1)
    padding(card, 8, 8, 6, 8)

    local cardLayout = Instance.new("UIListLayout")
    cardLayout.Padding = UDim.new(0, 6)
    cardLayout.Parent = card

    local head = Instance.new("Frame")
    head.Name = "CardHeader"
    head.Size = UDim2.new(1, 0, 0, 20)
    head.BackgroundTransparency = 1
    head.Parent = card

    local acc = Instance.new("Frame")
    acc.Size = UDim2.fromOffset(3, 14)
    acc.Position = UDim2.fromOffset(0, 3)
    acc.BackgroundColor3 = THEME.Accent
    acc.BorderSizePixel = 0
    acc.Parent = head
    corner(acc, 2)

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = title
    lbl.Size = UDim2.new(1, -12, 1, 0)
    lbl.Position = UDim2.fromOffset(8, 0)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.Text
    lbl.Font = FONT_BOLD
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = head

    local div = Instance.new("Frame")
    div.Size = UDim2.new(1, 0, 0, 1)
    div.BackgroundColor3 = THEME.BorderDim
    div.BorderSizePixel = 0
    div.Parent = card

    local body = Instance.new("Frame")
    body.Name = "Body"
    body.BackgroundTransparency = 1
    body.Size = UDim2.new(1, 0, 0, 0)
    body.AutomaticSize = Enum.AutomaticSize.Y
    body.Parent = card

    local list = Instance.new("UIListLayout")
    list.Padding = UDim.new(0, 6)
    list.Parent = body

    return card, body
end

local function createToggle(parent, setting, defaultState, onChange)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 30)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = setting
    lbl.Size = UDim2.new(1, -54, 1, 0)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.TextMuted
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.fromOffset(42, 22)
    btn.Position = UDim2.new(1, -42, 0.5, -11)
    btn.BackgroundColor3 = defaultState and THEME.Accent or THEME.CardAlt
    btn.Text = ""
    btn.AutoButtonColor = false
    btn.Parent = row
    corner(btn, 11)
    stroke(btn, defaultState and THEME.AccentBright or THEME.BorderDim, 1)

    local knob = Instance.new("Frame")
    knob.Size = UDim2.fromOffset(16, 16)
    knob.Position = defaultState and UDim2.new(1, -19, 0.5, -8) or UDim2.fromOffset(3, 3)
    knob.BackgroundColor3 = THEME.Text
    knob.Parent = btn
    corner(knob, 8)

    local state = defaultState
    local function apply(v)
        if type(v) ~= "boolean" then return end
        state = v
        tween(btn, TweenInfo.new(0.14), { BackgroundColor3 = state and THEME.Accent or THEME.CardAlt })
        tween(knob, TweenInfo.new(0.14), { Position = state and UDim2.new(1, -19, 0.5, -8) or UDim2.fromOffset(3, 3) })
        _G.FireEvent(setting, state)
        if onChange then onChange(state) end
    end
    state = bindSetting(setting, defaultState, apply, function(v) return type(v) == "boolean" end)
    apply(state)

    trackConnection(btn.MouseButton1Click:Connect(function() apply(not state) end))
    return row
end

local function createSlider(parent, setting, min, max, default, step, suffix)
    step = step or 1
    suffix = suffix or ""

    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 46)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local titleLbl = Instance.new("TextLabel")
    titleLbl.BackgroundTransparency = 1
    titleLbl.Text = setting
    titleLbl.Size = UDim2.new(0.6, 0, 0, 16)
    titleLbl.TextSize = 11
    titleLbl.TextColor3 = THEME.TextMuted
    titleLbl.Font = FONT
    titleLbl.TextXAlignment = Enum.TextXAlignment.Left
    titleLbl.Parent = row

    local valLbl = Instance.new("TextLabel")
    valLbl.BackgroundTransparency = 1
    valLbl.Text = tostring(default) .. suffix
    valLbl.Size = UDim2.new(0.4, 0, 0, 16)
    valLbl.Position = UDim2.new(0.6, 0, 0, 0)
    valLbl.TextSize = 11
    valLbl.TextColor3 = THEME.AccentBright
    valLbl.Font = FONT_BOLD
    valLbl.TextXAlignment = Enum.TextXAlignment.Right
    valLbl.Parent = row

    local track = Instance.new("Frame")
    track.Size = UDim2.new(1, 0, 0, 10)
    track.Position = UDim2.fromOffset(0, 24)
    track.BackgroundColor3 = THEME.CardAlt
    track.Parent = row
    corner(track, 5)
    stroke(track, THEME.BorderDim, 1)

    local fill = Instance.new("Frame")
    fill.Size = UDim2.new((default - min) / (max - min), 0, 1, 0)
    fill.BackgroundColor3 = THEME.Accent
    fill.Parent = track
    corner(fill, 5)

    local knob = Instance.new("Frame")
    knob.Size = UDim2.fromOffset(16, 16)
    knob.AnchorPoint = Vector2.new(0.5, 0.5)
    knob.Position = UDim2.new((default - min) / (max - min), 0, 0.5, 0)
    knob.BackgroundColor3 = THEME.Text
    knob.Parent = track
    corner(knob, 8)
    stroke(knob, THEME.AccentBright, 1)

    local val = default
    local dragging = false

    local function apply(value)
        if type(value) ~= "number" then return end
        val = math.clamp(math.floor(value / step + 0.5) * step, min, max)
        local pct = (val - min) / (max - min)
        fill.Size = UDim2.new(pct, 0, 1, 0)
        knob.Position = UDim2.new(pct, 0, 0.5, 0)
        valLbl.Text = tostring(val) .. suffix
        _G.FireEvent(setting, val)
    end
    val = bindSetting(setting, default, apply, function(v) return type(v) == "number" and v >= min and v <= max end)
    apply(val)

    local function update(inputPos)
        local relX = math.clamp((inputPos.X - track.AbsolutePosition.X) / track.AbsoluteSize.X, 0, 1)
        apply(min + (relX * (max - min)))
    end

    trackConnection(row.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = true
            update(input.Position)
        end
    end))

    trackConnection(UserInputService.InputChanged:Connect(function(input)
        if dragging and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseMovement) then
            update(input.Position)
        end
    end))

    trackConnection(UserInputService.InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = false
        end
    end))

    return row
end

local function createDropdown(parent, setting, options, default, onChange)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 52)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local titleLbl = Instance.new("TextLabel")
    titleLbl.BackgroundTransparency = 1
    titleLbl.Text = setting
    titleLbl.Size = UDim2.new(1, 0, 0, 16)
    titleLbl.TextSize = 11
    titleLbl.TextColor3 = THEME.TextMuted
    titleLbl.Font = FONT
    titleLbl.TextXAlignment = Enum.TextXAlignment.Left
    titleLbl.Parent = row

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(1, 0, 0, 28)
    btn.Position = UDim2.fromOffset(0, 20)
    btn.BackgroundColor3 = THEME.CardAlt
    btn.Text = "  " .. tostring(default or options[1])
    btn.TextColor3 = THEME.Text
    btn.TextSize = 11
    btn.Font = FONT
    btn.TextXAlignment = Enum.TextXAlignment.Left
    btn.AutoButtonColor = false
    btn.Parent = row
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    local arrow = Instance.new("TextLabel")
    arrow.BackgroundTransparency = 1
    arrow.Text = "▼"
    arrow.Size = UDim2.fromOffset(24, 28)
    arrow.Position = UDim2.new(1, -24, 0, 0)
    arrow.TextColor3 = THEME.AccentBright
    arrow.TextSize = 10
    arrow.Parent = btn

    local dropFrame = Instance.new("Frame")
    dropFrame.Size = UDim2.new(1, 0, 0, #options * 28 + 6)
    dropFrame.Position = UDim2.new(0, 0, 1, 4)
    dropFrame.BackgroundColor3 = THEME.Header
    dropFrame.Visible = false
    dropFrame.ZIndex = 80
    dropFrame.Parent = btn
    corner(dropFrame, 6)
    stroke(dropFrame, THEME.Accent, 1)
    padding(dropFrame, 4, 4, 4, 4)

    local dropList = Instance.new("UIListLayout")
    dropList.Padding = UDim.new(0, 2)
    dropList.Parent = dropFrame

    local selected = default or options[1]
    local open = false

    local function toggle()
        open = not open
        dropFrame.Visible = open
        arrow.Text = open and "▲" or "▼"
    end

    trackConnection(btn.MouseButton1Click:Connect(toggle))

    local optionButtons = {}
    local function apply(value)
        if not table.find(options, value) then return end
        selected = value
        btn.Text = "  " .. tostring(selected)
        for _, optBtn in ipairs(optionButtons) do
            optBtn.TextColor3 = optBtn.Text == "  " .. tostring(selected) and THEME.AccentBright or THEME.TextMuted
        end
        _G.FireEvent(setting, selected)
        if onChange then onChange(selected) end
    end

    for _, opt in ipairs(options) do
        local optBtn = Instance.new("TextButton")
        optBtn.Size = UDim2.new(1, 0, 0, 26)
        optBtn.BackgroundColor3 = THEME.Card
        optBtn.Text = "  " .. tostring(opt)
        optBtn.TextColor3 = (opt == selected) and THEME.AccentBright or THEME.TextMuted
        optBtn.TextSize = 11
        optBtn.Font = FONT
        optBtn.TextXAlignment = Enum.TextXAlignment.Left
        optBtn.ZIndex = 81
        optBtn.Parent = dropFrame
        corner(optBtn, 4)
        table.insert(optionButtons, optBtn)

        trackConnection(optBtn.MouseButton1Click:Connect(function()
            apply(opt)
            toggle()
        end))
    end

    selected = bindSetting(setting, selected, apply, function(v) return table.find(options, v) ~= nil end)
    apply(selected)

    return row
end

local function createColorPicker(parent, setting, defaultColor, onChange)
    defaultColor = defaultColor or Color3.fromRGB(157, 48, 255)

    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 32)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = setting
    lbl.Size = UDim2.new(1, -50, 1, 0)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.TextMuted
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local preview = Instance.new("TextButton")
    preview.Size = UDim2.fromOffset(38, 22)
    preview.Position = UDim2.new(1, -38, 0.5, -11)
    preview.BackgroundColor3 = defaultColor
    preview.Text = ""
    preview.AutoButtonColor = false
    preview.Parent = row
    corner(preview, 6)
    stroke(preview, THEME.BorderDim, 1)

    local palette = {
        Color3.fromRGB(255, 255, 255), Color3.fromRGB(157, 48, 255),
        Color3.fromRGB(205, 104, 255), Color3.fromRGB(42, 255, 157),
        Color3.fromRGB(255, 75, 125), Color3.fromRGB(255, 215, 0),
        Color3.fromRGB(0, 150, 255), Color3.fromRGB(72, 72, 72)
    }

    local popover = Instance.new("Frame")
    popover.Size = UDim2.fromOffset(170, 70)
    popover.Position = UDim2.new(1, -170, 1, 4)
    popover.BackgroundColor3 = THEME.Header
    popover.Visible = false
    popover.ZIndex = 90
    popover.Parent = preview
    corner(popover, 8)
    stroke(popover, THEME.Accent, 1)
    padding(popover, 6, 6, 6, 6)

    local grid = Instance.new("UIGridLayout")
    grid.CellSize = UDim2.fromOffset(34, 26)
    grid.CellPadding = UDim2.fromOffset(4, 4)
    grid.Parent = popover

    local open = false
    local function apply(value)
        if typeof(value) ~= "Color3" then return end
        preview.BackgroundColor3 = value
        _G.FireEvent(setting, value)
        if onChange then onChange(value) end
    end
    defaultColor = bindSetting(setting, defaultColor, apply, function(v) return typeof(v) == "Color3" end)
    apply(defaultColor)

    trackConnection(preview.MouseButton1Click:Connect(function()
        open = not open
        popover.Visible = open
    end))

    for _, col in ipairs(palette) do
        local pBtn = Instance.new("TextButton")
        pBtn.BackgroundColor3 = col
        pBtn.Text = ""
        pBtn.ZIndex = 91
        pBtn.Parent = popover
        corner(pBtn, 4)
        trackConnection(pBtn.MouseButton1Click:Connect(function()
            open = false
            popover.Visible = false
            apply(col)
        end))
    end

    return row
end

local function createButton(parent, text, onClick)
    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(1, 0, 0, 32)
    btn.BackgroundColor3 = THEME.CardAlt
    btn.Text = text
    btn.TextColor3 = THEME.Text
    btn.TextSize = 11
    btn.Font = FONT_BOLD
    btn.AutoButtonColor = false
    btn.Parent = parent
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    trackConnection(btn.MouseButton1Click:Connect(function()
        tween(btn, TweenInfo.new(0.08), { BackgroundColor3 = THEME.AccentDark })
        task.wait(0.1)
        tween(btn, TweenInfo.new(0.08), { BackgroundColor3 = THEME.CardAlt })
        if onClick then onClick() end
    end))

    return btn
end

--//==================================================
--// BUILD MOBILE TABS
--//==================================================

local tabsData = {
    { Name = "Combat",   Icon = "🎯" },
    { Name = "Visuals",  Icon = "👁️" },
    { Name = "World",    Icon = "🌍" },
    { Name = "Player",   Icon = "🏃" },
    { Name = "Settings", Icon = "⚙️" }
}

for _, t in ipairs(tabsData) do
    local pName = t.Name
    createPage(pName)

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.fromOffset(92, 32)
    btn.BackgroundColor3 = THEME.Card
    btn.Text = t.Icon .. " " .. pName
    btn.TextColor3 = THEME.TextMuted
    btn.TextSize = 11
    btn.Font = FONT_BOLD
    btn.AutoButtonColor = false
    btn.Parent = TabBar
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    TabButtons[pName] = btn
    trackConnection(btn.MouseButton1Click:Connect(function() switchPage(pName) end))
end

-- ---------------------------------------------------
-- TAB 1: COMBAT
-- ---------------------------------------------------
local _, bSilent = createCard("Combat", "Silent Aim")
createToggle(bSilent, "Enable Silent Aim", false)
createDropdown(bSilent, "Silent Target Part", { "Head", "Torso", "Closest" }, "Head")
createSlider(bSilent, "Silent Aim Hit Chance", 1, 100, 100, 1, "%")
createSlider(bSilent, "Silent Aim FOV", 20, 600, 120, 5, "px")
createToggle(bSilent, "Show Silent FOV Circle", false)
createColorPicker(bSilent, "Silent FOV Color", Color3.fromRGB(205, 104, 255))
createToggle(bSilent, "Silent Team Check", true)
createToggle(bSilent, "Silent Wall Check", false)

local _, bAimbot = createCard("Combat", "Aimbot Assist")
createToggle(bAimbot, "Enable Aimbot", false)
createDropdown(bAimbot, "Aimbot Target Part", { "Head", "Torso", "Closest" }, "Head")
createSlider(bAimbot, "Aimbot Smoothness", 1, 25, 5, 1)
createSlider(bAimbot, "Aimbot FOV", 20, 600, 150, 5, "px")
createToggle(bAimbot, "Show Aimbot FOV Circle", false)
createColorPicker(bAimbot, "Aimbot FOV Color", Color3.fromRGB(157, 48, 255))
createToggle(bAimbot, "Aimbot Team Check", true)
createToggle(bAimbot, "Aimbot Wall Check", true)

local _, bTrigger = createCard("Combat", "Triggerbot")
createToggle(bTrigger, "Enable Triggerbot", false)
createSlider(bTrigger, "Triggerbot Delay", 0, 300, 50, 10, "ms")
createToggle(bTrigger, "Triggerbot Team Check", true)
createToggle(bTrigger, "Triggerbot Headshot Only", false)

local _, bHitbox = createCard("Combat", "Hitbox Expander")
createToggle(bHitbox, "Enable Hitbox Expander", false)
createDropdown(bHitbox, "Hitbox Part", { "Head", "HumanoidRootPart" }, "Head")
createSlider(bHitbox, "Hitbox Size", 2, 25, 6, 1, " studs")
createSlider(bHitbox, "Hitbox Transparency", 0, 100, 50, 5, "%")

-- ---------------------------------------------------
-- TAB 2: VISUALS
-- ---------------------------------------------------
local _, bPlayerESP = createCard("Visuals", "Player ESP")
createToggle(bPlayerESP, "Enable ESP", false)
createToggle(bPlayerESP, "Box ESP", false)
createToggle(bPlayerESP, "Box Fill", false)
createToggle(bPlayerESP, "Health Bar", false)
createToggle(bPlayerESP, "Name ESP", false)
createToggle(bPlayerESP, "Distance ESP", false)
createToggle(bPlayerESP, "Weapon ESP", false)
createToggle(bPlayerESP, "Skeleton ESP", false)
createToggle(bPlayerESP, "Snaplines", false)
createToggle(bPlayerESP, "Head Dot", false)
createToggle(bPlayerESP, "Off-Screen Arrows", false)
createToggle(bPlayerESP, "Chams / Highlights", false)
createToggle(bPlayerESP, "Team Check", true)
createSlider(bPlayerESP, "Max ESP Distance", 50, 3000, 1500, 25, " studs")

local _, bESPStyle = createCard("Visuals", "ESP Styling & Colors")
createColorPicker(bESPStyle, "Box Color", Color3.fromRGB(255, 255, 255))
createColorPicker(bESPStyle, "Box Fill Color", Color3.fromRGB(157, 48, 255))
createSlider(bESPStyle, "Box Fill Transparency", 0, 100, 25, 5, "%")
createColorPicker(bESPStyle, "Skeleton Color", Color3.fromRGB(245, 241, 255))
createColorPicker(bESPStyle, "Text Color", Color3.fromRGB(245, 241, 255))
createColorPicker(bESPStyle, "Snapline Color", Color3.fromRGB(205, 104, 255))
createDropdown(bESPStyle, "Snapline Origin", { "Bottom", "Center", "Top" }, "Bottom")
createColorPicker(bESPStyle, "Head Dot Color", Color3.fromRGB(255, 50, 50))
createSlider(bESPStyle, "Head Dot Size", 1, 15, 4, 1, "px")
createColorPicker(bESPStyle, "Off-Screen Color", Color3.fromRGB(255, 75, 125))
createSlider(bESPStyle, "Off-Screen Radius", 50, 400, 200, 10, "px")
createColorPicker(bESPStyle, "Chams Fill Color", Color3.fromRGB(157, 48, 255))
createColorPicker(bESPStyle, "Chams Outline Color", Color3.fromRGB(205, 104, 255))

-- ---------------------------------------------------
-- TAB 3: WORLD
-- ---------------------------------------------------
local _, bLighting = createCard("World", "Lighting & Ambience")
createToggle(bLighting, "Fullbright", false)
createSlider(bLighting, "Brightness", 1, 10, 3, 1)
createToggle(bLighting, "Remove Shadows", false)
createToggle(bLighting, "Clear Atmosphere / Fog", false)
createSlider(bLighting, "World Time of Day", 0, 24, 14, 1, " hrs")

local _, bCamera = createCard("World", "Camera & Effects")
createToggle(bCamera, "Custom Camera FOV", false)
createSlider(bCamera, "Camera FOV", 70, 120, 90, 1)
createToggle(bCamera, "Third Person", false)
createSlider(bCamera, "Third Person Distance", 5, 35, 12, 1, " studs")
createToggle(bCamera, "Bullet Tracers", false)
createColorPicker(bCamera, "Tracer Color", Color3.fromRGB(205, 104, 255))
createToggle(bCamera, "Hitmarker Sound", false)

-- ---------------------------------------------------
-- TAB 4: PLAYER
-- ---------------------------------------------------
local _, bMovement = createCard("Player", "Movement & Physics")
createToggle(bMovement, "Speed Multiplier", false)
createSlider(bMovement, "WalkSpeed", 16, 150, 24, 1)
createToggle(bMovement, "Infinite Jump", false)
createToggle(bMovement, "Bunny Hop", false)
createToggle(bMovement, "Fly", false)
createSlider(bMovement, "Fly Speed", 10, 150, 50, 5)
createToggle(bMovement, "Noclip", false)

local _, bUtils = createCard("Player", "Combat Utilities")
createToggle(bUtils, "Spinbot / Anti-Aim", false)
createSlider(bUtils, "Spin Speed", 1, 50, 15, 1)
createToggle(bUtils, "Crosshair Overlay", false)

-- ---------------------------------------------------
-- TAB 5: SETTINGS
-- ---------------------------------------------------
local _, bProfiles = createCard("Settings", "Configuration Profiles")
createButton(bProfiles, "Save Profile (Default)", function()
    if _G.AtomwareConfig then
        local ok = _G.AtomwareConfig:Save("Default")
        if ok and _G.AtomwareConfig.Notify then _G.AtomwareConfig:Notify("Saved: Default", 2) end
    end
end)
createButton(bProfiles, "Load Profile (Default)", function()
    if _G.AtomwareConfig then
        local ok = _G.AtomwareConfig:Load("Default")
        if ok and _G.AtomwareConfig.Notify then _G.AtomwareConfig:Notify("Loaded: Default", 2) end
    end
end)

local _, bHUD = createCard("Settings", "HUD & Overlays")
createToggle(bHUD, "Watermark", true, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetWatermarkVisible(v) end
end)
createToggle(bHUD, "FPS & Memory Counter", true, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetFPSCounterVisible(v) end
end)
createColorPicker(bHUD, "Theme Color", Color3.fromRGB(205, 104, 255), function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetWatermarkColor(v) end
end)

local _, bSystem = createCard("Settings", "System & Management")
createButton(bSystem, "Unload Script", function()
    if _G.AtomwareUnload then
        _G.AtomwareUnload()
    elseif _G.AtomwareConfig then
        _G.AtomwareConfig:Unload(ScreenGui)
    else
        ScreenGui:Destroy()
    end
end)

switchPage("Combat")
_G.AtomwareUILoaded = true
print("[Atomware: Rivals] Mobile UI Initialized Successfully")
