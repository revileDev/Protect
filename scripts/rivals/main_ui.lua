--[[
    Atomware UI (main_ui.lua)
    Desktop & Gamepad Framework for Atomware (Rivals)
    Features Fixed Non-Scrolling Sidebar & Header, Two-Column Responsive Cards,
    and Full Controller / Gamepad Navigation
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
--// THEME & STYLING
--//==================================================

local THEME = {
    Background      = Color3.fromRGB(6, 4, 12),
    Header          = Color3.fromRGB(10, 7, 20),
    Sidebar         = Color3.fromRGB(10, 7, 20),
    Card            = Color3.fromRGB(14, 9, 26),
    CardAlt         = Color3.fromRGB(19, 13, 35),
    CardHover       = Color3.fromRGB(25, 16, 45),

    Border          = Color3.fromRGB(90, 38, 165),
    BorderDim       = Color3.fromRGB(45, 24, 80),
    Accent          = Color3.fromRGB(157, 48, 255),
    AccentBright    = Color3.fromRGB(205, 104, 255),
    AccentDark      = Color3.fromRGB(70, 24, 125),

    Text            = Color3.fromRGB(245, 241, 255),
    TextMuted       = Color3.fromRGB(160, 145, 195),
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
ScreenGui.Name = "AtomwareUI"
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
    _G.AtomwareConfig:AttachUI(ScreenGui, "Desktop")
end

--//==================================================
--// MAIN WINDOW (DESKTOP)
--//==================================================

local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.AnchorPoint = Vector2.new(0.5, 0.5)
MainFrame.Position = UDim2.fromScale(0.5, 0.5)
MainFrame.Size = UDim2.fromOffset(740, 500)
MainFrame.BackgroundColor3 = THEME.Background
MainFrame.BorderSizePixel = 0
MainFrame.ClipsDescendants = true
MainFrame.Parent = ScreenGui
corner(MainFrame, 12)
stroke(MainFrame, THEME.Border, 1.5)

local UIVisible = true
local function setUIVisible(state)
    UIVisible = state
    if state then
        MainFrame.Visible = true
        tween(MainFrame, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
            Size = UDim2.fromOffset(740, 500)
        })
    else
        tween(MainFrame, TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
            Size = UDim2.fromOffset(0, 0)
        }).Completed:Once(function()
            if not UIVisible then MainFrame.Visible = false end
        end)
    end
end

-- Dragging System
local dragging, dragStart, startPos
local function beginDrag(input)
    dragging = true
    dragStart = input.Position
    startPos = MainFrame.Position
    trackConnection(input.Changed:Connect(function()
        if input.UserInputState == Enum.UserInputState.End then dragging = false end
    end))
end

trackConnection(UserInputService.InputChanged:Connect(function(input)
    if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
        local delta = input.Position - dragStart
        MainFrame.Position = UDim2.new(
            startPos.X.Scale, startPos.X.Offset + delta.X,
            startPos.Y.Scale, startPos.Y.Offset + delta.Y
        )
    end
end))

-- Fixed Header
local Header = Instance.new("Frame")
Header.Name = "Header"
Header.Size = UDim2.new(1, 0, 0, 48)
Header.BackgroundColor3 = THEME.Header
Header.BorderSizePixel = 0
Header.Parent = MainFrame
stroke(Header, THEME.BorderDim, 1)

trackConnection(Header.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        beginDrag(input)
    end
end))

local HeaderAccent = Instance.new("Frame")
HeaderAccent.Size = UDim2.fromOffset(4, 26)
HeaderAccent.Position = UDim2.fromOffset(12, 11)
HeaderAccent.BackgroundColor3 = THEME.Accent
HeaderAccent.BorderSizePixel = 0
HeaderAccent.Parent = Header
corner(HeaderAccent, 2)

local Title = Instance.new("TextLabel")
Title.BackgroundTransparency = 1
Title.Text = "atomware  <font color=\"#cd68ff\">v2</font>  <font color=\"#a091c3\">•  rivals</font>"
Title.RichText = true
Title.Size = UDim2.new(0.5, 0, 1, 0)
Title.Position = UDim2.fromOffset(24, 0)
Title.TextSize = 18
Title.TextColor3 = THEME.Text
Title.Font = FONT_BOLD
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.Parent = Header

local CloseBtn = Instance.new("TextButton")
CloseBtn.Size = UDim2.fromOffset(32, 28)
CloseBtn.Position = UDim2.new(1, -40, 0, 10)
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

local MinBtn = Instance.new("TextButton")
MinBtn.Size = UDim2.fromOffset(32, 28)
MinBtn.Position = UDim2.new(1, -78, 0, 10)
MinBtn.BackgroundColor3 = THEME.Card
MinBtn.Text = "—"
MinBtn.TextColor3 = THEME.Text
MinBtn.TextSize = 13
MinBtn.Font = FONT_BOLD
MinBtn.AutoButtonColor = false
MinBtn.Parent = Header
corner(MinBtn, 6)
stroke(MinBtn, THEME.BorderDim, 1)
trackConnection(MinBtn.MouseButton1Click:Connect(function() setUIVisible(false) end))

-- Left Sidebar
local Sidebar = Instance.new("Frame")
Sidebar.Name = "Sidebar"
Sidebar.Size = UDim2.new(0, 175, 1, -58)
Sidebar.Position = UDim2.fromOffset(10, 52)
Sidebar.BackgroundColor3 = THEME.Sidebar
Sidebar.BorderSizePixel = 0
Sidebar.Parent = MainFrame
corner(Sidebar, 10)
stroke(Sidebar, THEME.BorderDim, 1)
padding(Sidebar, 8, 8, 10, 10)

local SidebarLayout = Instance.new("UIListLayout")
SidebarLayout.Padding = UDim.new(0, 6)
SidebarLayout.Parent = Sidebar

-- Content Area
local ContentArea = Instance.new("Frame")
ContentArea.Name = "ContentArea"
ContentArea.BackgroundTransparency = 1
ContentArea.Position = UDim2.fromOffset(193, 52)
ContentArea.Size = UDim2.new(1, -203, 1, -58)
ContentArea.Parent = MainFrame

local Pages = {}
local PageColumns = {}
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
    padding(page, 4, 8, 2, 14)

    local columns = {}
    for i = 1, 2 do
        local column = Instance.new("Frame")
        column.Name = i == 1 and "LeftColumn" or "RightColumn"
        column.BackgroundTransparency = 1
        column.Position = UDim2.new((i - 1) * 0.5, i == 1 and 4 or 2, 0, 2)
        column.Size = UDim2.new(0.5, -6, 0, 0)
        column.AutomaticSize = Enum.AutomaticSize.Y
        column.Parent = page

        local colLayout = Instance.new("UIListLayout")
        colLayout.Padding = UDim.new(0, 8)
        colLayout.SortOrder = Enum.SortOrder.LayoutOrder
        colLayout.Parent = column
        columns[i] = column
    end

    PageColumns[page] = { Columns = columns, Counts = { 0, 0 } }
    Pages[name] = page
    return page
end

local function switchPage(name)
    CurrentPageName = name
    for pName, pFrame in pairs(Pages) do
        pFrame.Visible = (pName == name)
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
--// WIDGET BUILDERS
--//==================================================

local function createCard(parent, title)
    local cardParent = parent
    local pageLayout = PageColumns[parent]
    if pageLayout then
        local counts = pageLayout.Counts
        local columnIndex = counts[1] <= counts[2] and 1 or 2
        counts[columnIndex] = counts[columnIndex] + 1
        cardParent = pageLayout.Columns[columnIndex]
    end

    local card = Instance.new("Frame")
    card.Name = title .. "Card"
    card.BackgroundColor3 = THEME.Card
    card.Size = UDim2.new(1, 0, 0, 0)
    card.AutomaticSize = Enum.AutomaticSize.Y
    card.Parent = cardParent
    corner(card, 8)
    stroke(card, THEME.BorderDim, 1)
    padding(card, 10, 10, 8, 10)

    local cardLayout = Instance.new("UIListLayout")
    cardLayout.Padding = UDim.new(0, 6)
    cardLayout.SortOrder = Enum.SortOrder.LayoutOrder
    cardLayout.Parent = card

    local head = Instance.new("Frame")
    head.Name = "CardHeader"
    head.LayoutOrder = 1
    head.Size = UDim2.new(1, 0, 0, 22)
    head.BackgroundTransparency = 1
    head.Parent = card

    local acc = Instance.new("Frame")
    acc.Size = UDim2.fromOffset(3, 15)
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
    lbl.TextSize = 12
    lbl.TextColor3 = THEME.Text
    lbl.Font = FONT_BOLD
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = head

    local div = Instance.new("Frame")
    div.Name = "Divider"
    div.LayoutOrder = 2
    div.Size = UDim2.new(1, 0, 0, 1)
    div.BackgroundColor3 = THEME.BorderDim
    div.BorderSizePixel = 0
    div.Parent = card

    local body = Instance.new("Frame")
    body.Name = "Body"
    body.LayoutOrder = 3
    body.BackgroundTransparency = 1
    body.Size = UDim2.new(1, 0, 0, 0)
    body.AutomaticSize = Enum.AutomaticSize.Y
    body.Parent = card

    local list = Instance.new("UIListLayout")
    list.Padding = UDim.new(0, 6)
    list.SortOrder = Enum.SortOrder.LayoutOrder
    list.Parent = body

    return card, body
end

local function createToggle(parent, setting, defaultState, onChange)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 28)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = setting
    lbl.Size = UDim2.new(1, -52, 1, 0)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.TextMuted
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.fromOffset(40, 20)
    btn.Position = UDim2.new(1, -40, 0.5, -10)
    btn.BackgroundColor3 = defaultState and THEME.Accent or THEME.CardAlt
    btn.Text = ""
    btn.AutoButtonColor = false
    btn.Parent = row
    corner(btn, 10)
    stroke(btn, defaultState and THEME.AccentBright or THEME.BorderDim, 1)

    local knob = Instance.new("Frame")
    knob.Size = UDim2.fromOffset(14, 14)
    knob.Position = defaultState and UDim2.new(1, -17, 0.5, -7) or UDim2.fromOffset(3, 3)
    knob.BackgroundColor3 = THEME.Text
    knob.Parent = btn
    corner(knob, 7)

    local state = defaultState
    local function apply(v)
        if type(v) ~= "boolean" then return end
        state = v
        tween(btn, TweenInfo.new(0.14), { BackgroundColor3 = state and THEME.Accent or THEME.CardAlt })
        tween(knob, TweenInfo.new(0.14), { Position = state and UDim2.new(1, -17, 0.5, -7) or UDim2.fromOffset(3, 3) })
        _G.FireEvent(setting, state)
        if onChange then onChange(state) end
    end
    state = bindSetting(setting, defaultState, apply, function(v) return type(v) == "boolean" end)
    apply(state)

    trackConnection(btn.MouseButton1Click:Connect(function()
        apply(not state)
    end))

    return row
end

local function createSlider(parent, setting, min, max, default, step, suffix)
    step = step or 1
    suffix = suffix or ""

    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 42)
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
    track.Size = UDim2.new(1, 0, 0, 8)
    track.Position = UDim2.fromOffset(0, 24)
    track.BackgroundColor3 = THEME.CardAlt
    track.Parent = row
    corner(track, 4)
    stroke(track, THEME.BorderDim, 1)

    local fill = Instance.new("Frame")
    fill.Size = UDim2.new((default - min) / (max - min), 0, 1, 0)
    fill.BackgroundColor3 = THEME.Accent
    fill.Parent = track
    corner(fill, 4)

    local knob = Instance.new("Frame")
    knob.Size = UDim2.fromOffset(14, 14)
    knob.AnchorPoint = Vector2.new(0.5, 0.5)
    knob.Position = UDim2.new((default - min) / (max - min), 0, 0.5, 0)
    knob.BackgroundColor3 = THEME.Text
    knob.Parent = track
    corner(knob, 7)
    stroke(knob, THEME.AccentBright, 1)

    local val = default
    local draggingSlider = false

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
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            draggingSlider = true
            update(input.Position)
        end
    end))

    trackConnection(UserInputService.InputChanged:Connect(function(input)
        if draggingSlider and input.UserInputType == Enum.UserInputType.MouseMovement then
            update(input.Position)
        end
    end))

    trackConnection(UserInputService.InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            draggingSlider = false
        end
    end))

    return row
end

local function createDropdown(parent, setting, options, default, onChange)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 50)
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
    btn.Size = UDim2.new(1, 0, 0, 26)
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
    arrow.Size = UDim2.fromOffset(24, 26)
    arrow.Position = UDim2.new(1, -24, 0, 0)
    arrow.TextColor3 = THEME.AccentBright
    arrow.TextSize = 10
    arrow.Parent = btn

    local dropFrame = Instance.new("Frame")
    dropFrame.Size = UDim2.new(1, 0, 0, #options * 26 + 6)
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
        optBtn.Size = UDim2.new(1, 0, 0, 24)
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
    row.Size = UDim2.new(1, 0, 0, 30)
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
    preview.Size = UDim2.fromOffset(36, 20)
    preview.Position = UDim2.new(1, -36, 0.5, -10)
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

local function createKeybind(parent, setting, defaultKey)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 30)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = setting
    lbl.Size = UDim2.new(1, -70, 1, 0)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.TextMuted
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.fromOffset(65, 22)
    btn.Position = UDim2.new(1, -65, 0.5, -11)
    btn.BackgroundColor3 = THEME.CardAlt
    btn.Text = defaultKey or "None"
    btn.TextColor3 = THEME.AccentBright
    btn.TextSize = 11
    btn.Font = FONT_BOLD
    btn.AutoButtonColor = false
    btn.Parent = row
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    local listening = false
    local boundKey = defaultKey or "None"

    local function apply(keyName)
        if type(keyName) ~= "string" or keyName == "" then return end
        boundKey = keyName
        btn.Text = keyName
        if _G.AtomwareConfig then _G.AtomwareConfig:Store(setting, keyName) end
        _G.FireEvent(setting, keyName)
        if _G.AtomwareConfig then _G.AtomwareConfig:Refresh() end
    end
    boundKey = bindSetting(setting, boundKey, apply, function(v) return type(v) == "string" and #v > 0 end)
    apply(boundKey)
    if _G.AtomwareConfig then _G.AtomwareConfig:RegisterKeybind(setting, function() return boundKey end) end

    trackConnection(btn.MouseButton1Click:Connect(function()
        listening = true
        btn.Text = "..."
        btn.TextColor3 = THEME.Red
    end))

    trackConnection(UserInputService.InputBegan:Connect(function(input, gpe)
        if listening then
            if input.UserInputType == Enum.UserInputType.Keyboard
                or input.UserInputType == Enum.UserInputType.MouseButton1
                or input.UserInputType == Enum.UserInputType.MouseButton2 then
                local isMouse = input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.MouseButton2
                local kName = isMouse and input.UserInputType.Name or input.KeyCode.Name
                listening = false
                btn.TextColor3 = THEME.AccentBright
                apply(kName)
            end
        elseif not gpe and boundKey ~= "None" and (input.KeyCode.Name == boundKey or input.UserInputType.Name == boundKey) then
            _G.FireEvent(setting .. " Pressed")
            if setting == "Menu Toggle Key" then
                setUIVisible(not UIVisible)
            end
        end
    end))

    return row
end

local function createButton(parent, text, onClick)
    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(1, 0, 0, 30)
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

local function createInput(parent, title, placeholder, onSubmit)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 52)
    row.BackgroundTransparency = 1
    row.Parent = parent

    local lbl = Instance.new("TextLabel")
    lbl.BackgroundTransparency = 1
    lbl.Text = title
    lbl.Size = UDim2.new(1, 0, 0, 16)
    lbl.TextSize = 11
    lbl.TextColor3 = THEME.TextMuted
    lbl.Font = FONT
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.Parent = row

    local tb = Instance.new("TextBox")
    tb.Size = UDim2.new(1, 0, 0, 28)
    tb.Position = UDim2.fromOffset(0, 20)
    tb.BackgroundColor3 = THEME.CardAlt
    tb.PlaceholderText = placeholder or "Type here..."
    tb.PlaceholderColor3 = THEME.TextMuted
    tb.Text = ""
    tb.TextColor3 = THEME.Text
    tb.TextSize = 11
    tb.Font = FONT
    tb.ClearTextOnFocus = false
    tb.Parent = row
    corner(tb, 6)
    stroke(tb, THEME.BorderDim, 1)
    padding(tb, 8, 8, 0, 0)

    if onSubmit then
        trackConnection(tb.FocusLost:Connect(function(enterPressed)
            if enterPressed and #tb.Text > 0 then
                onSubmit(tb.Text)
            end
        end))
    end

    return row, tb
end

--//==================================================
--// BUILD TABS & SECTIONS
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
    btn.Size = UDim2.new(1, 0, 0, 36)
    btn.BackgroundColor3 = THEME.Card
    btn.Text = "  " .. t.Icon .. "  " .. pName
    btn.TextColor3 = THEME.TextMuted
    btn.TextSize = 12
    btn.Font = FONT_BOLD
    btn.TextXAlignment = Enum.TextXAlignment.Left
    btn.AutoButtonColor = false
    btn.Parent = Sidebar
    corner(btn, 6)
    stroke(btn, THEME.BorderDim, 1)

    TabButtons[pName] = btn
    trackConnection(btn.MouseButton1Click:Connect(function() switchPage(pName) end))
end

-- ---------------------------------------------------
-- TAB 1: COMBAT
-- ---------------------------------------------------
local pCombat = Pages["Combat"]

local _, bSilent = createCard(pCombat, "Silent Aim")
createToggle(bSilent, "Enable Silent Aim", false)
createDropdown(bSilent, "Silent Target Part", { "Head", "Torso", "Closest" }, "Head")
createSlider(bSilent, "Silent Aim Hit Chance", 1, 100, 100, 1, "%")
createSlider(bSilent, "Silent Aim FOV", 20, 600, 120, 5, "px")
createToggle(bSilent, "Show Silent FOV Circle", false)
createColorPicker(bSilent, "Silent FOV Color", Color3.fromRGB(205, 104, 255))
createToggle(bSilent, "Silent Team Check", true)
createToggle(bSilent, "Silent Wall Check", false)

local _, bAimbot = createCard(pCombat, "Aimbot Assist")
createToggle(bAimbot, "Enable Aimbot", false)
createKeybind(bAimbot, "Aimbot Key", "MouseButton2")
createDropdown(bAimbot, "Aimbot Target Part", { "Head", "Torso", "Closest" }, "Head")
createSlider(bAimbot, "Aimbot Smoothness", 1, 25, 5, 1)
createSlider(bAimbot, "Aimbot FOV", 20, 600, 150, 5, "px")
createToggle(bAimbot, "Show Aimbot FOV Circle", false)
createColorPicker(bAimbot, "Aimbot FOV Color", Color3.fromRGB(157, 48, 255))
createToggle(bAimbot, "Aimbot Team Check", true)
createToggle(bAimbot, "Aimbot Wall Check", true)

local _, bTrigger = createCard(pCombat, "Triggerbot")
createToggle(bTrigger, "Enable Triggerbot", false)
createSlider(bTrigger, "Triggerbot Delay", 0, 300, 50, 10, "ms")
createToggle(bTrigger, "Triggerbot Team Check", true)
createToggle(bTrigger, "Triggerbot Headshot Only", false)

local _, bHitbox = createCard(pCombat, "Hitbox Expander")
createToggle(bHitbox, "Enable Hitbox Expander", false)
createDropdown(bHitbox, "Hitbox Part", { "Head", "HumanoidRootPart" }, "Head")
createSlider(bHitbox, "Hitbox Size", 2, 25, 6, 1, " studs")
createSlider(bHitbox, "Hitbox Transparency", 0, 100, 50, 5, "%")

-- ---------------------------------------------------
-- TAB 2: VISUALS
-- ---------------------------------------------------
local pVisuals = Pages["Visuals"]

local _, bPlayerESP = createCard(pVisuals, "Player ESP")
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

local _, bESPStyle = createCard(pVisuals, "ESP Styling & Colors")
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
local pWorld = Pages["World"]

local _, bLighting = createCard(pWorld, "Lighting & Ambience")
createToggle(bLighting, "Fullbright", false)
createSlider(bLighting, "Brightness", 1, 10, 3, 1)
createToggle(bLighting, "Remove Shadows", false)
createToggle(bLighting, "Clear Atmosphere / Fog", false)
createSlider(bLighting, "World Time of Day", 0, 24, 14, 1, " hrs")

local _, bCamera = createCard(pWorld, "Camera & Effects")
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
local pPlayer = Pages["Player"]

local _, bMovement = createCard(pPlayer, "Movement & Physics")
createToggle(bMovement, "Speed Multiplier", false)
createSlider(bMovement, "WalkSpeed", 16, 150, 24, 1)
createToggle(bMovement, "Infinite Jump", false)
createToggle(bMovement, "Bunny Hop", false)
createToggle(bMovement, "Fly", false)
createSlider(bMovement, "Fly Speed", 10, 150, 50, 5)
createToggle(bMovement, "Noclip", false)

local _, bUtils = createCard(pPlayer, "Combat Utilities")
createToggle(bUtils, "Spinbot / Anti-Aim", false)
createSlider(bUtils, "Spin Speed", 1, 50, 15, 1)
createToggle(bUtils, "Crosshair Overlay", false)

-- ---------------------------------------------------
-- TAB 5: SETTINGS
-- ---------------------------------------------------
local pSettings = Pages["Settings"]

local _, bProfiles = createCard(pSettings, "Configuration Profiles")
local _, profileInput = createInput(bProfiles, "Profile Name", "Default", function(text)
    if _G.AtomwareConfig then _G.AtomwareConfig:Save(text) end
end)
createButton(bProfiles, "Save Profile", function()
    local name = profileInput.Text ~= "" and profileInput.Text or "Default"
    if _G.AtomwareConfig then
        local ok, err = _G.AtomwareConfig:Save(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Profile saved: " .. name, 2.5)
        elseif err and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Error: " .. tostring(err), 3)
        end
    end
end)
createButton(bProfiles, "Load Profile", function()
    local name = profileInput.Text ~= "" and profileInput.Text or "Default"
    if _G.AtomwareConfig then
        local ok, err = _G.AtomwareConfig:Load(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Profile loaded: " .. name, 2.5)
        elseif err and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Error: " .. tostring(err), 3)
        end
    end
end)
createButton(bProfiles, "Set Autoload", function()
    local name = profileInput.Text ~= "" and profileInput.Text or "Default"
    if _G.AtomwareConfig then
        local ok = _G.AtomwareConfig:SetAutoload(name)
        if ok and _G.AtomwareConfig.Notify then
            _G.AtomwareConfig:Notify("Autoload set to: " .. name, 2.5)
        end
    end
end)

local _, bHUD = createCard(pSettings, "HUD & Overlays")
createToggle(bHUD, "Watermark", true, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetWatermarkVisible(v) end
end)
createToggle(bHUD, "FPS & Memory Counter", true, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetFPSCounterVisible(v) end
end)
createToggle(bHUD, "Keybind List", false, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetKeybindListVisible(v) end
end)
createToggle(bHUD, "Custom Cyber Cursor", false, function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetCustomCursorVisible(v) end
end)
createColorPicker(bHUD, "Theme Color", Color3.fromRGB(205, 104, 255), function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetWatermarkColor(v) end
end)
createDropdown(bHUD, "Notification Corner", { "TopRight", "TopLeft", "BottomRight", "BottomLeft" }, "TopRight", function(v)
    if _G.AtomwareConfig then _G.AtomwareConfig:SetNotificationCorner(v) end
end)

local _, bSystem = createCard(pSettings, "System & Management")
createKeybind(bSystem, "Menu Toggle Key", "RightControl")
createButton(bSystem, "Unload Script", function()
    if _G.AtomwareUnload then
        _G.AtomwareUnload()
    elseif _G.AtomwareConfig then
        _G.AtomwareConfig:Unload(ScreenGui)
    else
        ScreenGui:Destroy()
    end
end)

-- Default to Combat tab
switchPage("Combat")
_G.AtomwareUILoaded = true
print("[Atomware: Rivals] Desktop UI Initialized Successfully")
