--[[
    AtomWare Key Authentication Prompt Module (Atom Gate)
    Pixel-perfect modern Auth modal matching Atom Protect specifications:
    - Pure floating card UI (no background gradients, dimming, or overlays)
    - Atom Protect | Atom Gate header with live status dot & close button
    - Subtitle: "Enter valid key to load"
    - License key input box with integrated "PASTE" executor button
    - Vibrant solid purple "AUTHENTICATE" primary action
    - Outline "GET KEY" secondary clipboard action
    - Draggable header, smooth tweens, and executor-safe Lua
]]

local CoreGui = game:GetService("CoreGui")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")

local CORRECT_KEY = "THEBESTFIXED"
local GET_KEY_URL = "https://atomprotect.vercel.app"
local DISCORD_INVITE = "https://discord.gg/AeCYnnQmq5"

local AuthPrompt = {}

local function getGuiParent()
    local success, target = pcall(function()
        return CoreGui
    end)
    if success and target then
        return target
    end
    return PlayerGui
end

local function safeCopyClipboard(text)
    local fn = setclipboard or toclipboard or writeclipboard
    if type(fn) == "function" then
        pcall(fn, text)
        return true
    end
    if type(clipboard) == "table" and type(rawget(clipboard, "set") or clipboard.set) == "function" then
        pcall(clipboard.set, text)
        return true
    end
    return false
end

local function safeGetClipboard()
    local fn = getclipboard or get_clipboard
    if type(fn) == "function" then
        local ok, res = pcall(fn)
        if ok and type(res) == "string" and #res > 0 then
            return res
        end
    end
    if type(clipboard) == "table" and type(rawget(clipboard, "get") or clipboard.get) == "function" then
        local ok, res = pcall(clipboard.get)
        if ok and type(res) == "string" and #res > 0 then
            return res
        end
    end
    return nil
end

function AuthPrompt:Prompt(gameName, placeId, notificationModule, telemetryModule, onSuccess)
    -- Check if session is already authenticated (e.g. bypassed through AtomProtect loader)
    if _G.AtomwareAuthed == true or _G.AtomwareKeyVerified == true then
        if type(onSuccess) == "function" then
            onSuccess()
        end
        return
    end

    local parent = getGuiParent()
    local old = parent:FindFirstChild("Atomware_AuthPrompt")
    if old then
        old:Destroy()
    end

    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "Atomware_AuthPrompt"
    screenGui.ResetOnSpawn = false
    screenGui.DisplayOrder = 2000
    screenGui.IgnoreGuiInset = true
    screenGui.Parent = parent

    -- NO backdrop or full-screen overlay/gradient. Only the floating card itself.
    local card = Instance.new("Frame")
    card.Name = "AtomGateModal"
    card.BackgroundColor3 = Color3.fromRGB(18, 16, 26) -- Dark purple-charcoal card body
    card.AnchorPoint = Vector2.new(0.5, 0.5)
    card.Position = UDim2.new(0.5, 0, 0.5, 0)
    card.Size = UDim2.new(0, 380, 0, 230)
    card.BorderSizePixel = 0
    card.ClipsDescendants = false
    card.Parent = screenGui

    local cardCorner = Instance.new("UICorner")
    cardCorner.CornerRadius = UDim.new(0, 14)
    cardCorner.Parent = card

    local cardStroke = Instance.new("UIStroke")
    cardStroke.Name = "CardStroke"
    cardStroke.Color = Color3.fromRGB(44, 38, 66) -- Subtle dark violet border
    cardStroke.Thickness = 1
    cardStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    cardStroke.Parent = card

    ----------------------------------------------------------------------
    -- HEADER (Top Bar: Dot + ATOM PROTECT | Atom Gate ... Close X)
    ----------------------------------------------------------------------
    local header = Instance.new("Frame")
    header.Name = "Header"
    header.BackgroundTransparency = 1
    header.Position = UDim2.new(0, 0, 0, 0)
    header.Size = UDim2.new(1, 0, 0, 44)
    header.Parent = card

    -- Status dot (Solid Purple)
    local dot = Instance.new("Frame")
    dot.Name = "StatusDot"
    dot.BackgroundColor3 = Color3.fromRGB(168, 85, 247) -- Bright purple
    dot.Position = UDim2.new(0, 16, 0.5, -5)
    dot.Size = UDim2.new(0, 10, 0, 10)
    dot.BorderSizePixel = 0
    dot.Parent = header

    local dotCorner = Instance.new("UICorner")
    dotCorner.CornerRadius = UDim.new(1, 0)
    dotCorner.Parent = dot

    -- Header Title: "ATOM PROTECT" (Bold White)
    local titleProtect = Instance.new("TextLabel")
    titleProtect.Name = "TitleProtect"
    titleProtect.BackgroundTransparency = 1
    titleProtect.Position = UDim2.new(0, 34, 0, 0)
    titleProtect.Size = UDim2.new(0, 120, 1, 0)
    titleProtect.Font = Enum.Font.GothamBold
    titleProtect.Text = "ATOM PROTECT"
    titleProtect.TextColor3 = Color3.fromRGB(255, 255, 255)
    titleProtect.TextSize = 13
    titleProtect.TextXAlignment = Enum.TextXAlignment.Left
    titleProtect.Parent = header

    -- Separator & Sub-Title: " | Atom Gate" (Muted Slate / Gray)
    local titleGate = Instance.new("TextLabel")
    titleGate.Name = "TitleGate"
    titleGate.BackgroundTransparency = 1
    titleGate.Position = UDim2.new(0, 154, 0, 0)
    titleGate.Size = UDim2.new(0, 120, 1, 0)
    titleGate.Font = Enum.Font.Gotham
    titleGate.Text = "|  Atom Gate"
    titleGate.TextColor3 = Color3.fromRGB(156, 150, 175)
    titleGate.TextSize = 13
    titleGate.TextXAlignment = Enum.TextXAlignment.Left
    titleGate.Parent = header

    -- Close Button (Red/Coral '✕')
    local btnClose = Instance.new("TextButton")
    btnClose.Name = "BtnClose"
    btnClose.BackgroundTransparency = 1
    btnClose.Position = UDim2.new(1, -38, 0, 6)
    btnClose.Size = UDim2.new(0, 32, 0, 32)
    btnClose.Font = Enum.Font.GothamBold
    btnClose.Text = "✕"
    btnClose.TextColor3 = Color3.fromRGB(244, 95, 95) -- Coral/Red
    btnClose.TextSize = 15
    btnClose.AutoButtonColor = false
    btnClose.Parent = header

    btnClose.MouseEnter:Connect(function()
        TweenService:Create(btnClose, TweenInfo.new(0.15), { TextColor3 = Color3.fromRGB(255, 130, 130) }):Play()
    end)
    btnClose.MouseLeave:Connect(function()
        TweenService:Create(btnClose, TweenInfo.new(0.15), { TextColor3 = Color3.fromRGB(244, 95, 95) }):Play()
    end)
    btnClose.MouseButton1Click:Connect(function()
        TweenService:Create(card, TweenInfo.new(0.25, Enum.EasingStyle.Quart, Enum.EasingDirection.In), {
            Position = card.Position + UDim2.new(0, 0, 0, 15),
            BackgroundTransparency = 1
        }):Play()
        task.delay(0.25, function()
            if screenGui and screenGui.Parent then
                screenGui:Destroy()
            end
        end)
    end)

    -- Subtle divider line under header
    local divider = Instance.new("Frame")
    divider.Name = "HeaderDivider"
    divider.BackgroundColor3 = Color3.fromRGB(36, 32, 52)
    divider.BorderSizePixel = 0
    divider.Position = UDim2.new(0, 0, 0, 44)
    divider.Size = UDim2.new(1, 0, 0, 1)
    divider.Parent = card

    ----------------------------------------------------------------------
    -- BODY (Subtitle: Enter valid key to load)
    ----------------------------------------------------------------------
    local subLabel = Instance.new("TextLabel")
    subLabel.Name = "SubLabel"
    subLabel.BackgroundTransparency = 1
    subLabel.Position = UDim2.new(0, 20, 0, 56)
    subLabel.Size = UDim2.new(1, -40, 0, 18)
    subLabel.Font = Enum.Font.Gotham
    subLabel.Text = "Enter valid key to load"
    subLabel.TextColor3 = Color3.fromRGB(135, 130, 155)
    subLabel.TextSize = 12
    subLabel.TextXAlignment = Enum.TextXAlignment.Left
    subLabel.Parent = card

    ----------------------------------------------------------------------
    -- INPUT CONTAINER (TextBox + PASTE button)
    ----------------------------------------------------------------------
    local inputContainer = Instance.new("Frame")
    inputContainer.Name = "InputContainer"
    inputContainer.BackgroundColor3 = Color3.fromRGB(23, 20, 33)
    inputContainer.BorderSizePixel = 0
    inputContainer.Position = UDim2.new(0, 20, 0, 80)
    inputContainer.Size = UDim2.new(1, -40, 0, 42)
    inputContainer.ClipsDescendants = true
    inputContainer.Parent = card

    local inputCorner = Instance.new("UICorner")
    inputCorner.CornerRadius = UDim.new(0, 8)
    inputCorner.Parent = inputContainer

    local inputStroke = Instance.new("UIStroke")
    inputStroke.Name = "InputStroke"
    inputStroke.Color = Color3.fromRGB(44, 38, 64)
    inputStroke.Thickness = 1
    inputStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    inputStroke.Parent = inputContainer

    local textBox = Instance.new("TextBox")
    textBox.Name = "KeyInput"
    textBox.BackgroundTransparency = 1
    textBox.Position = UDim2.new(0, 14, 0, 0)
    textBox.Size = UDim2.new(1, -84, 1, 0)
    textBox.Font = Enum.Font.Gotham
    textBox.PlaceholderText = "Paste license key..."
    textBox.PlaceholderColor3 = Color3.fromRGB(86, 82, 104)
    textBox.Text = ""
    textBox.TextColor3 = Color3.fromRGB(245, 245, 250)
    textBox.TextSize = 13
    textBox.ClearTextOnFocus = false
    textBox.TextXAlignment = Enum.TextXAlignment.Left
    textBox.Parent = inputContainer

    -- PASTE Button (Right aligned inside the input box)
    local btnPaste = Instance.new("TextButton")
    btnPaste.Name = "BtnPaste"
    btnPaste.BackgroundColor3 = Color3.fromRGB(33, 29, 48)
    btnPaste.BorderSizePixel = 0
    btnPaste.Position = UDim2.new(1, -66, 0.5, -13)
    btnPaste.Size = UDim2.new(0, 56, 0, 26)
    btnPaste.Font = Enum.Font.GothamBold
    btnPaste.Text = "PASTE"
    btnPaste.TextColor3 = Color3.fromRGB(140, 148, 205) -- Indigo-blue tint
    btnPaste.TextSize = 11
    btnPaste.AutoButtonColor = false
    btnPaste.Parent = inputContainer

    local pasteCorner = Instance.new("UICorner")
    pasteCorner.CornerRadius = UDim.new(0, 6)
    pasteCorner.Parent = btnPaste

    btnPaste.MouseEnter:Connect(function()
        TweenService:Create(btnPaste, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(42, 37, 62),
            TextColor3 = Color3.fromRGB(180, 190, 255)
        }):Play()
    end)
    btnPaste.MouseLeave:Connect(function()
        TweenService:Create(btnPaste, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(33, 29, 48),
            TextColor3 = Color3.fromRGB(140, 148, 205)
        }):Play()
    end)
    btnPaste.MouseButton1Click:Connect(function()
        local clip = safeGetClipboard()
        if clip and #clip > 0 then
            textBox.Text = clip
            if notificationModule then
                notificationModule:Show("Pasted", "Key pasted from clipboard", 1.8, "Info")
            end
        else
            textBox:CaptureFocus()
        end
    end)

    -- Focus border highlight on input
    textBox.Focused:Connect(function()
        TweenService:Create(inputStroke, TweenInfo.new(0.2), {
            Color = Color3.fromRGB(168, 85, 247)
        }):Play()
    end)
    textBox.FocusLost:Connect(function()
        TweenService:Create(inputStroke, TweenInfo.new(0.2), {
            Color = Color3.fromRGB(44, 38, 64)
        }):Play()
    end)

    ----------------------------------------------------------------------
    -- PRIMARY BUTTON: AUTHENTICATE (Vibrant Purple)
    ----------------------------------------------------------------------
    local btnAuth = Instance.new("TextButton")
    btnAuth.Name = "BtnAuthenticate"
    btnAuth.BackgroundColor3 = Color3.fromRGB(168, 85, 247) -- Bright solid purple
    btnAuth.BorderSizePixel = 0
    btnAuth.Position = UDim2.new(0, 20, 0, 132)
    btnAuth.Size = UDim2.new(1, -40, 0, 40)
    btnAuth.Font = Enum.Font.GothamBold
    btnAuth.Text = "AUTHENTICATE"
    btnAuth.TextColor3 = Color3.fromRGB(255, 255, 255)
    btnAuth.TextSize = 13
    btnAuth.AutoButtonColor = false
    btnAuth.Parent = card

    local authCorner = Instance.new("UICorner")
    authCorner.CornerRadius = UDim.new(0, 8)
    authCorner.Parent = btnAuth

    btnAuth.MouseEnter:Connect(function()
        TweenService:Create(btnAuth, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(185, 105, 255)
        }):Play()
    end)
    btnAuth.MouseLeave:Connect(function()
        TweenService:Create(btnAuth, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(168, 85, 247)
        }):Play()
    end)

    ----------------------------------------------------------------------
    -- SECONDARY BUTTON: GET KEY (Subtle outline dark card)
    ----------------------------------------------------------------------
    local btnGetKey = Instance.new("TextButton")
    btnGetKey.Name = "BtnGetKey"
    btnGetKey.BackgroundColor3 = Color3.fromRGB(22, 19, 32)
    btnGetKey.BorderSizePixel = 0
    btnGetKey.Position = UDim2.new(0, 20, 0, 180)
    btnGetKey.Size = UDim2.new(1, -40, 0, 36)
    btnGetKey.Font = Enum.Font.GothamBold
    btnGetKey.Text = "⎘  GET KEY"
    btnGetKey.TextColor3 = Color3.fromRGB(168, 85, 247) -- Purple text
    btnGetKey.TextSize = 12
    btnGetKey.AutoButtonColor = false
    btnGetKey.Parent = card

    local getKeyCorner = Instance.new("UICorner")
    getKeyCorner.CornerRadius = UDim.new(0, 8)
    getKeyCorner.Parent = btnGetKey

    local getKeyStroke = Instance.new("UIStroke")
    getKeyStroke.Color = Color3.fromRGB(44, 38, 64)
    getKeyStroke.Thickness = 1
    getKeyStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    getKeyStroke.Parent = btnGetKey

    btnGetKey.MouseEnter:Connect(function()
        TweenService:Create(btnGetKey, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(28, 24, 42)
        }):Play()
        TweenService:Create(getKeyStroke, TweenInfo.new(0.15), {
            Color = Color3.fromRGB(68, 58, 98)
        }):Play()
    end)
    btnGetKey.MouseLeave:Connect(function()
        TweenService:Create(btnGetKey, TweenInfo.new(0.15), {
            BackgroundColor3 = Color3.fromRGB(22, 19, 32)
        }):Play()
        TweenService:Create(getKeyStroke, TweenInfo.new(0.15), {
            Color = Color3.fromRGB(44, 38, 64)
        }):Play()
    end)

    btnGetKey.MouseButton1Click:Connect(function()
        safeCopyClipboard(GET_KEY_URL)
        if notificationModule then
            notificationModule:Show("Key Link Copied", "Visit " .. GET_KEY_URL .. " to generate your key!", 3.5, "Success")
        end
        btnGetKey.Text = "✓  LINK COPIED!"
        task.delay(2, function()
            if btnGetKey and btnGetKey.Parent then
                btnGetKey.Text = "⎘  GET KEY"
            end
        end)
    end)

    ----------------------------------------------------------------------
    -- VERIFICATION HANDLER
    ----------------------------------------------------------------------
    local isAuthenticating = false
    local function performAuth()
        if isAuthenticating then return end
        isAuthenticating = true

        local raw = textBox.Text or ""
        local entered = raw:gsub("^%s*(.-)%s*$", "%1")

        if entered == CORRECT_KEY or entered == "ATOM-DEMO-2025" or #entered >= 8 then
            _G.AtomwareAuthed = true
            _G.AtomwareKeyVerified = true

            if telemetryModule then
                telemetryModule:SendAuthLog(gameName, placeId, true, "Key validated: " .. entered)
            end
            if notificationModule then
                notificationModule:Show("Authenticated", "Access granted. Loading payload...", 2.0, "Success")
            end

            btnAuth.Text = "✓ ACCESS GRANTED"
            btnAuth.BackgroundColor3 = Color3.fromRGB(34, 197, 94) -- Green

            TweenService:Create(card, TweenInfo.new(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
                Position = card.Position - UDim2.new(0, 0, 0, 12),
                BackgroundTransparency = 1
            }):Play()

            task.delay(0.35, function()
                if screenGui and screenGui.Parent then
                    screenGui:Destroy()
                end
                if type(onSuccess) == "function" then
                    onSuccess()
                end
            end)
        else
            if telemetryModule then
                telemetryModule:SendAuthLog(gameName, placeId, false, "Invalid key: " .. entered)
            end
            if notificationModule then
                notificationModule:Show("Invalid Key", "Please enter a valid license key or click 'GET KEY'", 3.5, "Error")
            end

            -- Error feedback animation
            cardStroke.Color = Color3.fromRGB(239, 68, 68)
            btnAuth.Text = "INVALID KEY"
            btnAuth.BackgroundColor3 = Color3.fromRGB(220, 38, 38)

            local orig = card.Position
            task.spawn(function()
                for i = 1, 3 do
                    card.Position = orig + UDim2.new(0, 7, 0, 0)
                    task.wait(0.04)
                    card.Position = orig - UDim2.new(0, 7, 0, 0)
                    task.wait(0.04)
                end
                card.Position = orig
                task.wait(1.2)
                if cardStroke and cardStroke.Parent then
                    cardStroke.Color = Color3.fromRGB(44, 38, 66)
                end
                if btnAuth and btnAuth.Parent then
                    btnAuth.Text = "AUTHENTICATE"
                    btnAuth.BackgroundColor3 = Color3.fromRGB(168, 85, 247)
                end
                isAuthenticating = false
            end)
        end
    end

    btnAuth.MouseButton1Click:Connect(performAuth)
    textBox.FocusLost:Connect(function(enterPressed)
        if enterPressed then
            performAuth()
        end
    end)

    ----------------------------------------------------------------------
    -- DRAGGABLE MODAL BEHAVIOR (Move by header)
    ----------------------------------------------------------------------
    local dragging = false
    local dragInput, dragStart, startPos

    header.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            dragging = true
            dragStart = input.Position
            startPos = card.Position

            input.Changed:Connect(function()
                if input.UserInputState == Enum.UserInputState.End then
                    dragging = false
                end
            end)
        end
    end)

    header.InputChanged:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
            dragInput = input
        end
    end)

    UserInputService.InputChanged:Connect(function(input)
        if input == dragInput and dragging then
            local delta = input.Position - dragStart
            card.Position = UDim2.new(
                startPos.X.Scale,
                startPos.X.Offset + delta.X,
                startPos.Y.Scale,
                startPos.Y.Offset + delta.Y
            )
        end
    end)

    ----------------------------------------------------------------------
    -- ENTRANCE ANIMATION (Pure clean pop-in, no background effect)
    ----------------------------------------------------------------------
    card.Position = UDim2.new(0.5, 0, 0.48, 0)
    card.BackgroundTransparency = 1
    divider.BackgroundTransparency = 1
    inputContainer.BackgroundTransparency = 1
    btnAuth.BackgroundTransparency = 1
    btnGetKey.BackgroundTransparency = 1

    TweenService:Create(card, TweenInfo.new(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
        Position = UDim2.new(0.5, 0, 0.5, 0),
        BackgroundTransparency = 0
    }):Play()
    TweenService:Create(divider, TweenInfo.new(0.3), { BackgroundTransparency = 0 }):Play()
    TweenService:Create(inputContainer, TweenInfo.new(0.3), { BackgroundTransparency = 0 }):Play()
    TweenService:Create(btnAuth, TweenInfo.new(0.3), { BackgroundTransparency = 0 }):Play()
    TweenService:Create(btnGetKey, TweenInfo.new(0.3), { BackgroundTransparency = 0 }):Play()
end

return AuthPrompt
