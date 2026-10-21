--[[
    Atomware Rivals - mobile_lite_ui.lua (Full Responsive Rewrite)
    Ultra-Optimized Mobile Touch UI Framework for Low-Memory Devices (iPads / Budget Mobile)
    
    Features:
      - Identical Atomware Cyberpunk Branding & Palette
      - Glowing "LITE MODE" Header Badge
      - Draggable Floating Toggle Pill with Attached Lock Button
      - Two-Column Responsive Contained Cards (Left/Right Columns with AutomaticSize.Y)
      - Zero UIGridLayout clipping bugs (Cards expand fully to fit all controls)
      - Touch-sized Toggles (46x24), Sliders with smooth drag, and Dropdowns
      - Complete Settings Tab with Configuration Profiles (Save/Load/Autoload), HUD Overlays,
        Live Memory Telemetry, and Manual Garbage Collection
]]

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local CoreGui = game:GetService("CoreGui")
local Stats = game:GetService("Stats")

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
_G.AtomwarePendingEvents = _G.AtomwarePendingEvents or {}

local function registerAtomwareEvent(name, callback)
    _G.AtomwareEvents[name] = callback
    local pending = _G.AtomwarePendingEvents[name]
    if pending then
        _G.AtomwarePendingEvents[name] = nil
        task.spawn(function()
            local ok, err = pcall(callback, table.unpack(pending, 1, pending.n))
            if not ok then warn("[Atomware Lite] event '" .. name .. "' failed: " .. tostring(err)) end
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
            if not ok then warn("[Atomware Lite] event '" .. name .. "' failed: " .. tostring(err)) end
        end)
        return
    end
    local args = { ... }
    args.n = select("#", ...)
    _G.AtomwarePendingEvents[name] = args
end

--//==================================================
--// THEME & STYLING
--//==================================================

local THEME = {
    Background      = Color3.fromRGB(8, 6, 15),
    Header          = Color3.fromRGB(13, 9, 24),
    TabBar          = Color3.fromRGB(11, 8, 20),
    Card            = Color3.fromRGB(16, 11, 30),
    CardAlt         = Color3.fromRGB(24, 16, 44),
    CardHover       = Color3.fromRGB(32, 20, 56),

    Border          = Color3.fromRGB(105, 45, 195),
    BorderDim       = Color3.fromRGB(55, 30, 95),
    Accent          = Color3.fromRGB(157, 48, 255),
    AccentBright    = Color3.fromRGB(205, 104, 255),
    AccentDark      = Color3.fromRGB(80, 26, 142),
    LiteCyan        = Color3.fromRGB(42, 255, 200),

    Text            = Color3.fromRGB(245, 241, 255),
    TextMuted       = Color3.fromRGB(170, 155, 205),
    TextDim         = Color3.fromRGB(110, 95, 140),

    Green           = Color3.fromRGB(42, 255, 157),
    Red             = Color3.fromRGB(255, 75, 125),
}

local FONT = Enum.Font.GothamMedium
local FONT_BOLD = Enum.Font.GothamBold

local function tween(inst, info, props)
    local t = TweenService:Create(inst, info, props)
    t:Play()
    return t
end

local function corner(parent, radius)
    local c = Instance.new("UICorner")
    c.CornerRadius = UDim.new(0, radius or 8)
    c.Parent = parent
    return c
end

local function stroke(parent, color, thickness)
    local s = Instance.new("UIStroke")
    s.Color = color or THEME.BorderDim
    s.Thickness = thickness or 1
    s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    s.Parent = parent
    return s
end

local function padding(parent, top, bottom, left, right)
    local p = Instance.new("UIPadding")
    p.PaddingTop = UDim.new(0, top or 0)
    p.PaddingBottom = UDim.new(0, bottom or 0)
    p.PaddingLeft = UDim.new(0, left or 0)
    p.PaddingRight = UDim.new(0, right or 0)
    p.Parent = parent
    return p
end

--//==================================================
--// SCREENGUI & MAIN CONTAINERS
--//==================================================

local function getGuiParent()
    if typeof(gethui) == "function" then
        local ok, h = pcall(gethui)
        if ok and h then return h end
    end
    local playerGui = LocalPlayer:WaitForChild("PlayerGui", 10)
    return playerGui or CoreGui
end

local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "AtomwareMobileLiteRivalsUI"
ScreenGui.ResetOnSpawn = false
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
ScreenGui.DisplayOrder = 100
ScreenGui.Parent = getGuiParent()

if _G.AtomwareConfig then _G.AtomwareConfig:AttachUI(ScreenGui, "Mobile Lite Touch") end

local UIVisible = true
local isUILocked = false

--//==================================================
--// DRAGGABLE FLOATING TOGGLE PILL WITH LOCK
--//==================================================

local ToggleContainer = Instance.new("Frame")
ToggleContainer.Name = "AtomwareLiteToggleContainer"
ToggleContainer.Size = UDim2.fromOffset(130, 48)
ToggleContainer.Position = UDim2.new(1, -142, 0.28, 0)
ToggleContainer.BackgroundTransparency = 1
ToggleContainer.BorderSizePixel = 0
ToggleContainer.ZIndex = 200
ToggleContainer.Parent = ScreenGui

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

-- Floating Button (48x48)
local MobileToggleBtn = Instance.new("TextButton")
MobileToggleBtn.Name = "MobileToggle"
MobileToggleBtn.Size = UDim2.fromOffset(48, 48)
MobileToggleBtn.Position = UDim2.fromOffset(0, 0)
MobileToggleBtn.BackgroundColor3 = THEME.Header
MobileToggleBtn.Text = "AW"
MobileToggleBtn.TextColor3 = THEME.LiteCyan
MobileToggleBtn.TextSize = 16
MobileToggleBtn.Font = FONT_BOLD
MobileToggleBtn.AutoButtonColor = false
MobileToggleBtn.ZIndex = 201
MobileToggleBtn.Parent = ToggleContainer
corner(MobileToggleBtn, 24)
local toggleStroke = stroke(MobileToggleBtn, THEME.LiteCyan, 1.5)

-- Attached Lock Button
local ToggleLockBtn = Instance.new("TextButton")
ToggleLockBtn.Name = "MobileToggleLock"
ToggleLockBtn.Size = UDim2.fromOffset(68, 34)
ToggleLockBtn.Position = UDim2.fromOffset(54, 7)
ToggleLockBtn.BackgroundColor3 = THEME.Header
ToggleLockBtn.Text = "Lock"
ToggleLockBtn.TextColor3 = THEME.TextMuted
ToggleLockBtn.TextSize = 11
ToggleLockBtn.Font = FONT_BOLD
ToggleLockBtn.AutoButtonColor = false
ToggleLockBtn.ZIndex = 201
ToggleLockBtn.Parent = ToggleContainer
corner(ToggleLockBtn, 8)
local lockStroke = stroke(ToggleLockBtn, THEME.BorderDim, 1)

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

--//==================================================
--// MAIN WINDOW (RESPONSIVE CONTAINED FRAME)
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

local function setUIVisible(visible)
    UIVisible = visible
    MainFrame.Visible = UIVisible
    if UIVisible then
        MainFrame.Size = UDim2.new(0.96, 0, 0.90, 0)
    end
end

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
        ToggleLockBtn.Text = "Locked"
        ToggleLockBtn.TextColor3 = THEME.Red
        ToggleLockBtn.BackgroundColor3 = Color3.fromRGB(50, 16, 26)
        lockStroke.Color = THEME.Red
        MobileToggleBtn.BackgroundTransparency = 0.4
        toggleStroke.Color = THEME.BorderDim
    else
        ToggleLockBtn.Text = "Lock"
        ToggleLockBtn.TextColor3 = THEME.TextMuted
        ToggleLockBtn.BackgroundColor3 = THEME.Header
        lockStroke.Color = THEME.BorderDim
        MobileToggleBtn.BackgroundTransparency = 0
        toggleStroke.Color = THEME.LiteCyan
    end
end))

-- Fixed Header
local Header = Instance.new("Frame")
Header.Name = "Header"
Header.Size = UDim2.new(1, 0, 0, 44)
Header.BackgroundColor3 = THEME.Header
Header.BorderSizePixel = 0
Header.Parent = MainFrame
stroke(Header, THEME.BorderDim, 1)

local HeaderAccent = Instance.new("Frame")
HeaderAccent.Size = UDim2.fromOffset(4, 22)
HeaderAccent.Position = UDim2.fromOffset(12, 11)
HeaderAccent.BackgroundColor3 = THEME.LiteCyan
HeaderAccent.BorderSizePixel = 0
HeaderAccent.Parent = Header
corner(HeaderAccent, 2)

local Title = Instance.new("TextLabel")
Title.Name = "Title"
Title.Size = UDim2.fromOffset(110, 44)
Title.Position = UDim2.fromOffset(24, 0)
Title.BackgroundTransparency = 1
Title.Text = "ATOMWARE"
Title.TextColor3 = THEME.Text
Title.TextSize = 14
Title.Font = FONT_BOLD
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.Parent = Header

-- Lite Mode Badge
local LiteBadge = Instance.new("Frame")
LiteBadge.Size = UDim2.fromOffset(82, 22)
LiteBadge.Position = UDim2.fromOffset(136, 11)
LiteBadge.BackgroundColor3 = Color3.fromRGB(15, 35, 30)
LiteBadge.BorderSizePixel = 0
LiteBadge.Parent = Header
corner(LiteBadge, 4)
stroke(LiteBadge, THEME.LiteCyan, 1)

local LiteBadgeText = Instance.new("TextLabel")
LiteBadgeText.Size = UDim2.new(1, 0, 1, 0)
LiteBadgeText.BackgroundTransparency = 1
LiteBadgeText.Text = "LITE MODE"
LiteBadgeText.TextColor3 = THEME.LiteCyan
LiteBadgeText.TextSize = 10
LiteBadgeText.Font = FONT_BOLD
LiteBadgeText.Parent = LiteBadge

-- Live Memory Indicator in Header
local MemLabel = Instance.new("TextLabel")
MemLabel.Size = UDim2.fromOffset(120, 44)
MemLabel.Position = UDim2.new(1, -170, 0, 0)
MemLabel.BackgroundTransparency = 1
MemLabel.Text = "RAM: ... MB"
MemLabel.TextColor3 = THEME.TextMuted
MemLabel.TextSize = 11
MemLabel.Font = FONT
MemLabel.TextXAlignment = Enum.TextXAlignment.Right
MemLabel.Parent = Header

task.spawn(function()
    while ScreenGui and ScreenGui.Parent do
        local memMb = math.floor(Stats:GetTotalMemoryUsageMb())
        MemLabel.Text = "RAM: " .. tostring(memMb) .. " MB"
        if memMb > 1100 then
            MemLabel.TextColor3 = THEME.Red
        else
            MemLabel.TextColor3 = THEME.Green
        end
        task.wait(2)
    end
end)

local CloseBtn = Instance.new("TextButton")
CloseBtn.Name = "CloseBtn"
CloseBtn.Size = UDim2.fromOffset(32, 32)
CloseBtn.Position = UDim2.new(1, -40, 0, 6)
CloseBtn.BackgroundColor3 = THEME.Card
CloseBtn.Text = "X"
CloseBtn.TextColor3 = THEME.TextMuted
CloseBtn.TextSize = 13
CloseBtn.Font = FONT_BOLD
CloseBtn.Parent = Header
corner(CloseBtn, 6)
stroke(CloseBtn, THEME.BorderDim, 1)
trackConnection(CloseBtn.MouseButton1Click:Connect(function()
    setUIVisible(false)
end))

-- Horizontal Swipeable Tab Navigation Bar
local TabBar = Instance.new("ScrollingFrame")
TabBar.Name = "TabBar"
TabBar.Size = UDim2.new(1, 0, 0, 42)
TabBar.Position = UDim2.fromOffset(0, 44)
TabBar.BackgroundColor3 = THEME.TabBar
TabBar.BorderSizePixel = 0
TabBar.ScrollBarThickness = 0
TabBar.CanvasSize = UDim2.fromOffset(560, 0)
TabBar.Parent = MainFrame
stroke(TabBar, THEME.BorderDim, 1)
padding(TabBar, 5, 5, 10, 10)

local TabLayout = Instance.new("UIListLayout")
TabLayout.FillDirection = Enum.FillDirection.Horizontal
TabLayout.SortOrder = Enum.SortOrder.LayoutOrder
TabLayout.Padding = UDim.new(0, 8)
TabLayout.Parent = TabBar

-- Content Area
local ContentArea = Instance.new("Frame")
ContentArea.Name = "ContentArea"
ContentArea.Size = UDim2.new(1, 0, 1, -86)
ContentArea.Position = UDim2.fromOffset(0, 86)
ContentArea.BackgroundTransparency = 1
ContentArea.Parent = MainFrame

-- Tab Management & Two-Column System
local Pages = {}
local PageColumns = {}
local TabButtons = {}
local CurrentPageName = "Combat"
local responsiveLayouts = {}

local function updateResponsiveLayouts()
    local cam = workspace.CurrentCamera
    local vp = cam and cam.ViewportSize or Vector2.new(800, 600)
    local isNarrow = vp.X < 560
    for _, item in ipairs(responsiveLayouts) do
        if isNarrow then
            item.left.Size = UDim2.new(1, 0, 0, 0)
            item.right.Size = UDim2.new(1, 0, 0, 0)
            item.layout.FillDirection = Enum.FillDirection.Vertical
        else
            item.left.Size = UDim2.new(0.5, -4, 0, 0)
            item.right.Size = UDim2.new(0.5, -4, 0, 0)
            item.layout.FillDirection = Enum.FillDirection.Horizontal
        end
    end
end

if workspace.CurrentCamera then
    trackConnection(workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(updateResponsiveLayouts))
end

local function switchPage(name)
    CurrentPageName = name
    for pName, pFrame in pairs(Pages) do
        pFrame.Visible = (pName == name)
    end
    for pName, btn in pairs(TabButtons) do
        local active = (pName == name)
        tween(btn, TweenInfo.new(0.14), {
            BackgroundColor3 = active and THEME.AccentDark or THEME.Card,
            TextColor3 = active and THEME.AccentBright or THEME.TextMuted,
        })
    end
end

local function getOrCreatePage(name, layoutOrder)
    if Pages[name] then return Pages[name] end

    -- Tab Button
    local btn = Instance.new("TextButton")
    btn.Name = name .. "TabBtn"
    btn.Size = UDim2.fromOffset(108, 32)
    btn.BackgroundColor3 = (name == CurrentPageName) and THEME.AccentDark or THEME.Card
    btn.Text = name
    btn.TextColor3 = (name == CurrentPageName) and THEME.AccentBright or THEME.TextMuted
    btn.TextSize = 12
    btn.Font = FONT_BOLD
    btn.LayoutOrder = layoutOrder or 1
    btn.AutoButtonColor = false
    btn.Parent = TabBar
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    trackConnection(btn.MouseButton1Click:Connect(function()
        switchPage(name)
    end))
    TabButtons[name] = btn

    -- Page Container
    local page = Instance.new("ScrollingFrame")
    page.Name = name .. "Page"
    page.BackgroundTransparency = 1
    page.BorderSizePixel = 0
    page.Size = UDim2.new(1, 0, 1, 0)
    page.CanvasSize = UDim2.new(0, 0, 0, 0)
    page.AutomaticCanvasSize = Enum.AutomaticSize.Y
    page.ScrollBarThickness = 3
    page.ScrollBarImageColor3 = THEME.Accent
    page.Visible = (name == CurrentPageName)
    page.Parent = ContentArea
    padding(page, 8, 16, 8, 8)

    -- Two-Column Horizontal Container
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
    leftCol.Name = "LeftColumn"
    leftCol.BackgroundTransparency = 1
    leftCol.Size = UDim2.new(0.5, -4, 0, 0)
    leftCol.AutomaticSize = Enum.AutomaticSize.Y
    leftCol.Parent = colContainer

    local leftList = Instance.new("UIListLayout")
    leftList.Padding = UDim.new(0, 8)
    leftList.SortOrder = Enum.SortOrder.LayoutOrder
    leftList.Parent = leftCol

    local rightCol = Instance.new("Frame")
    rightCol.Name = "RightColumn"
    rightCol.BackgroundTransparency = 1
    rightCol.Size = UDim2.new(0.5, -4, 0, 0)
    rightCol.AutomaticSize = Enum.AutomaticSize.Y
    rightCol.Parent = colContainer

    local rightList = Instance.new("UIListLayout")
    rightList.Padding = UDim.new(0, 8)
    rightList.SortOrder = Enum.SortOrder.LayoutOrder
    rightList.Parent = rightCol

    table.insert(responsiveLayouts, { layout = hList, left = leftCol, right = rightCol })
    updateResponsiveLayouts()

    PageColumns[page] = { Columns = { leftCol, rightCol }, Counts = { 0, 0 } }
    Pages[name] = page
    return page
end

-- Two-Column Card Helper
local function createCard(page, titleText, preferredCol)
    local meta = PageColumns[page]
    local targetCol = meta.Columns[1]

    if preferredCol == "left" or preferredCol == 1 then
        targetCol = meta.Columns[1]
    elseif preferredCol == "right" or preferredCol == 2 then
        targetCol = meta.Columns[2]
    else
        if meta.Counts[1] <= meta.Counts[2] then
            targetCol = meta.Columns[1]
            meta.Counts[1] = meta.Counts[1] + 1
        else
            targetCol = meta.Columns[2]
            meta.Counts[2] = meta.Counts[2] + 1
        end
    end

    local card = Instance.new("Frame")
    card.Name = titleText:gsub("%s+", "") .. "Card"
    card.BackgroundColor3 = THEME.Card
    card.BorderSizePixel = 0
    card.Size = UDim2.new(1, 0, 0, 0)
    card.AutomaticSize = Enum.AutomaticSize.Y
    card.Parent = targetCol
    corner(card, 8)
    stroke(card, THEME.BorderDim, 1)
    padding(card, 10, 12, 12, 12)

    local list = Instance.new("UIListLayout")
    list.SortOrder = Enum.SortOrder.LayoutOrder
    list.Padding = UDim.new(0, 8)
    list.Parent = card

    local cardHeader = Instance.new("TextLabel")
    cardHeader.Size = UDim2.new(1, 0, 0, 20)
    cardHeader.BackgroundTransparency = 1
    cardHeader.Text = titleText:upper()
    cardHeader.TextColor3 = THEME.AccentBright
    cardHeader.TextSize = 11
    cardHeader.Font = FONT_BOLD
    cardHeader.TextXAlignment = Enum.TextXAlignment.Left
    cardHeader.Parent = card

    return card
end

-- Component: Toggle (Touch friendly)
local function addToggle(card, labelText, default, callbackName)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 32)
    row.BackgroundTransparency = 1
    row.Parent = card

    local lbl = Instance.new("TextLabel")
    lbl.Size = UDim2.new(1, -54, 1, 0)
    lbl.BackgroundTransparency = 1
    lbl.Text = labelText
    lbl.TextColor3 = THEME.Text
    lbl.TextSize = 12
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local switch = Instance.new("TextButton")
    switch.Size = UDim2.fromOffset(46, 24)
    switch.Position = UDim2.new(1, -46, 0.5, -12)
    switch.BackgroundColor3 = default and THEME.Accent or THEME.CardAlt
    switch.Text = ""
    switch.AutoButtonColor = false
    switch.Parent = row
    corner(switch, 12)
    stroke(switch, default and THEME.AccentBright or THEME.BorderDim, 1)

    local knob = Instance.new("Frame")
    knob.Size = UDim2.fromOffset(18, 18)
    knob.Position = default and UDim2.fromOffset(25, 3) or UDim2.fromOffset(3, 3)
    knob.BackgroundColor3 = THEME.Text
    knob.BorderSizePixel = 0
    knob.Parent = switch
    corner(knob, 9)

    local state = default or false

    local function updateSwitch(val)
        state = val
        if state then
            tween(switch, TweenInfo.new(0.18), { BackgroundColor3 = THEME.Accent })
            tween(knob, TweenInfo.new(0.18), { Position = UDim2.fromOffset(25, 3) })
        else
            tween(switch, TweenInfo.new(0.18), { BackgroundColor3 = THEME.CardAlt })
            tween(knob, TweenInfo.new(0.18), { Position = UDim2.fromOffset(3, 3) })
        end
        if callbackName then _G.FireEvent(callbackName, state) end
    end

    trackConnection(switch.MouseButton1Click:Connect(function()
        updateSwitch(not state)
    end))

    return row, updateSwitch
end

-- Component: Slider (Touch friendly drag)
local function addSlider(card, labelText, min, max, default, callbackName, suffix)
    suffix = suffix or ""
    local container = Instance.new("Frame")
    container.Size = UDim2.new(1, 0, 0, 48)
    container.BackgroundTransparency = 1
    container.Parent = card

    local topRow = Instance.new("Frame")
    topRow.Size = UDim2.new(1, 0, 0, 18)
    topRow.BackgroundTransparency = 1
    topRow.Parent = container

    local lbl = Instance.new("TextLabel")
    lbl.Size = UDim2.new(0.7, 0, 1, 0)
    lbl.BackgroundTransparency = 1
    lbl.Text = labelText
    lbl.TextColor3 = THEME.Text
    lbl.TextSize = 12
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = topRow

    local valLbl = Instance.new("TextLabel")
    valLbl.Size = UDim2.new(0.3, 0, 1, 0)
    valLbl.Position = UDim2.new(0.7, 0, 0, 0)
    valLbl.BackgroundTransparency = 1
    valLbl.Text = tostring(default) .. suffix
    valLbl.TextColor3 = THEME.AccentBright
    valLbl.TextSize = 12
    valLbl.Font = FONT_BOLD
    valLbl.TextXAlignment = Enum.TextXAlignment.Right
    valLbl.Parent = topRow

    local bar = Instance.new("Frame")
    bar.Size = UDim2.new(1, 0, 0, 14)
    bar.Position = UDim2.fromOffset(0, 26)
    bar.BackgroundColor3 = THEME.CardAlt
    bar.BorderSizePixel = 0
    bar.Parent = container
    corner(bar, 7)
    stroke(bar, THEME.BorderDim, 1)

    local percent = math.clamp((default - min) / (max - min), 0, 1)
    local fill = Instance.new("Frame")
    fill.Size = UDim2.new(percent, 0, 1, 0)
    fill.BackgroundColor3 = THEME.Accent
    fill.BorderSizePixel = 0
    fill.Parent = bar
    corner(fill, 7)

    local isDragging = false

    local function updateFromInput(input)
        local relX = math.clamp(input.Position.X - bar.AbsolutePosition.X, 0, bar.AbsoluteSize.X)
        local pct = relX / bar.AbsoluteSize.X
        local val = math.floor(min + (max - min) * pct)
        fill.Size = UDim2.new(pct, 0, 1, 0)
        valLbl.Text = tostring(val) .. suffix
        if callbackName then _G.FireEvent(callbackName, val) end
    end

    trackConnection(bar.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            isDragging = true
            updateFromInput(input)
        end
    end))

    trackConnection(UserInputService.InputChanged:Connect(function(input)
        if isDragging and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseMovement) then
            updateFromInput(input)
        end
    end))

    trackConnection(UserInputService.InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
            isDragging = false
        end
    end))

    return container
end

-- Component: Dropdown (Contained)
local function addDropdown(card, labelText, options, default, callbackName)
    local container = Instance.new("Frame")
    container.Size = UDim2.new(1, 0, 0, 52)
    container.BackgroundTransparency = 1
    container.Parent = card

    local lbl = Instance.new("TextLabel")
    lbl.Size = UDim2.new(1, 0, 0, 18)
    lbl.BackgroundTransparency = 1
    lbl.Text = labelText
    lbl.TextColor3 = THEME.Text
    lbl.TextSize = 12
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = container

    local dropBtn = Instance.new("TextButton")
    dropBtn.Size = UDim2.new(1, 0, 0, 28)
    dropBtn.Position = UDim2.fromOffset(0, 22)
    dropBtn.BackgroundColor3 = THEME.CardAlt
    dropBtn.Text = "  " .. tostring(default)
    dropBtn.TextColor3 = THEME.Text
    dropBtn.TextSize = 12
    dropBtn.Font = FONT
    dropBtn.TextXAlignment = Enum.TextXAlignment.Left
    dropBtn.AutoButtonColor = false
    dropBtn.Parent = container
    corner(dropBtn, 6)
    stroke(dropBtn, THEME.BorderDim, 1)

    local arrow = Instance.new("TextLabel")
    arrow.Size = UDim2.fromOffset(20, 28)
    arrow.Position = UDim2.new(1, -24, 0, 0)
    arrow.BackgroundTransparency = 1
    arrow.Text = "v"
    arrow.TextColor3 = THEME.TextMuted
    arrow.TextSize = 10
    arrow.Font = FONT_BOLD
    arrow.Parent = dropBtn

    local currentIndex = table.find(options, default) or 1

    trackConnection(dropBtn.MouseButton1Click:Connect(function()
        currentIndex = (currentIndex % #options) + 1
        local selected = options[currentIndex]
        dropBtn.Text = "  " .. selected
        if callbackName then _G.FireEvent(callbackName, selected) end
    end))

    return container
end

-- Component: Action Button
local function addButton(card, btnText, color, onClick)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 36)
    row.BackgroundTransparency = 1
    row.Parent = card

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(1, 0, 1, 0)
    btn.BackgroundColor3 = color or THEME.CardAlt
    btn.Text = btnText
    btn.TextColor3 = THEME.Text
    btn.TextSize = 12
    btn.Font = FONT_BOLD
    btn.AutoButtonColor = false
    btn.Parent = row
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    trackConnection(btn.MouseButton1Click:Connect(function()
        pcall(onClick)
    end))

    return row
end

-- Component: Input TextBox
local function addInput(card, labelText, defaultText, onEnter)
    local container = Instance.new("Frame")
    container.Size = UDim2.new(1, 0, 0, 52)
    container.BackgroundTransparency = 1
    container.Parent = card

    local lbl = Instance.new("TextLabel")
    lbl.Size = UDim2.new(1, 0, 0, 18)
    lbl.BackgroundTransparency = 1
    lbl.Text = labelText
    lbl.TextColor3 = THEME.Text
    lbl.TextSize = 12
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = container

    local box = Instance.new("TextBox")
    box.Size = UDim2.new(1, 0, 0, 28)
    box.Position = UDim2.fromOffset(0, 22)
    box.BackgroundColor3 = THEME.CardAlt
    box.Text = defaultText or ""
    box.PlaceholderText = "Enter profile name..."
    box.TextColor3 = THEME.Text
    box.PlaceholderColor3 = THEME.TextDim
    box.TextSize = 12
    box.Font = FONT
    box.ClearTextOnFocus = false
    box.Parent = container
    corner(box, 6)
    stroke(box, THEME.BorderDim, 1)

    if onEnter then
        trackConnection(box.FocusLost:Connect(function(enterPressed)
            onEnter(box.Text)
        end))
    end

    return box
end

--//==================================================
--// POPULATE TABS & SECTIONS
--//==================================================

-- TAB 1: COMBAT
local combatPage = getOrCreatePage("Combat", 1)
local silentCard = createCard(combatPage, "Silent Aim", "left")
addToggle(silentCard, "Enable Silent Aim", false, "Enable Silent Aim")
addToggle(silentCard, "Show FOV Circle", false, "Show Silent FOV Circle")
addToggle(silentCard, "Silent Team Check", true, "Silent Team Check")
addToggle(silentCard, "Silent Wall Check", false, "Silent Wall Check")
addSlider(silentCard, "Hit Chance", 1, 100, 100, "Silent Aim Hit Chance", "%")
addSlider(silentCard, "FOV Radius", 20, 500, 120, "Silent Aim FOV")
addDropdown(silentCard, "Target Part", { "Head", "HumanoidRootPart" }, "Head", "Silent Target Part")

local aimbotCard = createCard(combatPage, "Aimbot & Hitbox", "right")
addToggle(aimbotCard, "Enable Aimbot", false, "Enable Aimbot")
addToggle(aimbotCard, "Show Aimbot FOV", false, "Show Aimbot FOV Circle")
addDropdown(aimbotCard, "Aimbot Activation", { "Always On", "MouseButton2", "MouseButton1" }, "Always On", "Aimbot Mode")
addSlider(aimbotCard, "Smoothness", 1, 20, 4, "Aimbot Smoothness")
addSlider(aimbotCard, "FOV Radius", 20, 500, 140, "Aimbot FOV")
addToggle(aimbotCard, "Hitbox Expander", false, "Enable Hitbox Expander")
addSlider(aimbotCard, "Hitbox Size", 2, 25, 8, "Hitbox Size")
addDropdown(aimbotCard, "Hitbox Target", { "HumanoidRootPart", "Head" }, "HumanoidRootPart", "Hitbox Part")

-- TAB 2: VISUALS (LITE)
local visualsPage = getOrCreatePage("Visuals", 2)
local espCard = createCard(visualsPage, "Core ESP (Zero GPU Chams)", "left")
addToggle(espCard, "Enable ESP Master", false, "Enable ESP")
addToggle(espCard, "2D Box ESP", false, "Box ESP")
addToggle(espCard, "Health Bar", false, "Health Bar")
addToggle(espCard, "Player Name", false, "Name ESP")
addToggle(espCard, "Distance Text", false, "Distance ESP")
addToggle(espCard, "Team Check", true, "Team Check")
addSlider(espCard, "Max Distance", 100, 2000, 1000, "Max ESP Distance", "m")

local liteNoticeCard = createCard(visualsPage, "Lite Mode Protection", "right")
local noticeLbl = Instance.new("TextLabel")
noticeLbl.Size = UDim2.new(1, 0, 0, 80)
noticeLbl.BackgroundTransparency = 1
noticeLbl.Text = "Chams / Highlights, 3D Character Models, and semi-transparent Box Fills are disabled in Lite Mode to eliminate iPad Jetsam memory crashes while preserving maximum FPS."
noticeLbl.TextColor3 = THEME.TextMuted
noticeLbl.TextSize = 11
noticeLbl.Font = FONT
noticeLbl.TextWrapped = true
noticeLbl.TextXAlignment = Enum.TextXAlignment.Left
noticeLbl.Parent = liteNoticeCard

-- TAB 3: WORLD & MOVEMENT
local worldPage = getOrCreatePage("World & Move", 3)
local worldCard = createCard(worldPage, "World Lighting", "left")
addToggle(worldCard, "Fullbright", false, "Fullbright")
addToggle(worldCard, "Clear Atmosphere / Fog", false, "Clear Atmosphere / Fog")
addToggle(worldCard, "Custom FOV", false, "Custom Camera FOV")
addSlider(worldCard, "Camera FOV", 60, 120, 90, "Camera FOV")

local moveCard = createCard(worldPage, "Movement Engine", "right")
addToggle(moveCard, "Speed Multiplier", false, "Speed Multiplier")
addSlider(moveCard, "WalkSpeed", 16, 60, 24, "WalkSpeed")
addToggle(moveCard, "Infinite Jump", false, "Infinite Jump")
addToggle(moveCard, "Bunny Hop", false, "Bunny Hop")

-- TAB 4: SETTINGS & CONFIGS
local settingsPage = getOrCreatePage("Settings", 4)
local configCard = createCard(settingsPage, "Configuration Profiles", "left")
local profileBox = addInput(configCard, "Profile Name", "Default", function(text)
    if _G.AtomwareConfig then _G.AtomwareConfig:Save(text) end
end)

addButton(configCard, "Save Profile", THEME.CardHover, function()
    local name = profileBox.Text ~= "" and profileBox.Text or "Default"
    if _G.AtomwareConfig then
        local ok, err = _G.AtomwareConfig:Save(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Profile saved: " .. name, 2.5)
        elseif err and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Error: " .. tostring(err), 3)
        end
    end
end)

addButton(configCard, "Load Profile", THEME.CardHover, function()
    local name = profileBox.Text ~= "" and profileBox.Text or "Default"
    if _G.AtomwareConfig then
        local ok, err = _G.AtomwareConfig:Load(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Profile loaded: " .. name, 2.5)
        elseif err and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Error: " .. tostring(err), 3)
        end
    end
end)

addButton(configCard, "Set Autoload", THEME.CardHover, function()
    local name = profileBox.Text ~= "" and profileBox.Text or "Default"
    if _G.AtomwareConfig then
        local ok = _G.AtomwareConfig:SetAutoload(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Autoload set to: " .. name, 2.5)
        end
    end
end)

local hudCard = createCard(settingsPage, "HUD & Diagnostics", "right")
addToggle(hudCard, "Watermark", true, nil)
addToggle(hudCard, "FPS & Memory Counter", true, nil)

local ramMetric = Instance.new("TextLabel")
ramMetric.Size = UDim2.new(1, 0, 0, 24)
ramMetric.BackgroundTransparency = 1
ramMetric.Text = "Current Engine RAM: ... MB"
ramMetric.TextColor3 = THEME.LiteCyan
ramMetric.TextSize = 12
ramMetric.Font = FONT_BOLD
ramMetric.TextXAlignment = Enum.TextXAlignment.Left
ramMetric.Parent = hudCard

task.spawn(function()
    while ScreenGui and ScreenGui.Parent do
        local mem = math.floor(Stats:GetTotalMemoryUsageMb())
        ramMetric.Text = "Current Engine RAM: " .. tostring(mem) .. " MB"
        task.wait(2)
    end
end)

addButton(hudCard, "PURGE MEMORY (CLEAN RAM)", Color3.fromRGB(35, 20, 50), function()
    pcall(function()
        collectgarbage("collect")
        if _G.AtomwareConfig and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Garbage Collector Purged Memory!", 2)
        end
    end)
end)

addButton(hudCard, "UNLOAD SCRIPT", Color3.fromRGB(50, 18, 30), function()
    if _G.AtomwareUnload then
        pcall(_G.AtomwareUnload)
    elseif ScreenGui then
        ScreenGui:Destroy()
    end
end)

-- Default to Combat Tab
switchPage("Combat")

_G.AtomwareUILoaded = true
_G.AtomwareWindow = MainFrame
print("[Atomware Rivals] Mobile_Lite UI Framework (Responsive Two-Column) Loaded Successfully!")
