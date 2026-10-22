const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'message (1).txt');
const destPath = path.join(__dirname, 'rivals', 'features.lua');

console.log('Reading main source from:', srcPath);
const raw = fs.readFileSync(srcPath, 'utf8');
const isCRLF = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

console.log('Total input lines:', lines.length, 'isCRLF:', isCRLF);

// 1. In loadDrawingLibrary, use mock/headless library if Lite Mode or Atomware ScreenGui UI is active
let loadDrawingIdx = -1;
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('local function loadDrawingLibrary(): any')) {
		loadDrawingIdx = i;
		break;
	}
}

if (loadDrawingIdx === -1) {
	console.error('Could not find loadDrawingLibrary in source!');
	process.exit(1);
}

const mockLibraryCode = [
	'local function loadDrawingLibrary(): any',
	'\tif _G.AtomwareLiteMode == true or _G.AtomwareWindow ~= nil or _G.AtomwareUILoaded == true then',
	'\t\tlocal function createMockSection(name)',
	'\t\t\tlocal sec = { text = name }',
	'\t\t\tfunction sec:AddToggle(opts)',
	'\t\t\t\tlocal tog = {',
	'\t\t\t\t\tstate = opts and opts.state or false,',
	'\t\t\t\t\tSetState = function(self, val, skip)',
	'\t\t\t\t\t\tself.state = val',
	'\t\t\t\t\t\tif not skip and opts and opts.callback then pcall(opts.callback, val) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tAddColor = function(self) return { SetColor = function() end } end,',
	'\t\t\t\t\tAddKeyPicker = function(self) return { SetKey = function() end } end,',
	'\t\t\t\t}',
	'\t\t\t\treturn tog',
	'\t\t\tend',
	'\t\t\tfunction sec:AddSlider(opts)',
	'\t\t\t\tlocal sli = {',
	'\t\t\t\t\tvalue = opts and opts.default or 0,',
	'\t\t\t\t\tSetValue = function(self, val, skip)',
	'\t\t\t\t\t\tself.value = val',
	'\t\t\t\t\t\tif not skip and opts and opts.callback then pcall(opts.callback, val) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t}',
	'\t\t\t\treturn sli',
	'\t\t\tend',
	'\t\t\tfunction sec:AddDropdown(opts)',
	'\t\t\t\tlocal drop = {',
	'\t\t\t\t\tselected = opts and opts.default or nil,',
	'\t\t\t\t\tSelect = function(self, val, skip)',
	'\t\t\t\t\t\tself.selected = val',
	'\t\t\t\t\t\tif not skip and opts and opts.callback then pcall(opts.callback, val) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tSetValues = function() end,',
	'\t\t\t\t\tAddValue = function() end,',
	'\t\t\t\t\tClearValues = function() end,',
	'\t\t\t\t}',
	'\t\t\t\treturn drop',
	'\t\t\tend',
	'\t\t\tfunction sec:AddList(opts)',
	'\t\t\t\tlocal list = {',
	'\t\t\t\t\tselected = opts and opts.default or nil,',
	'\t\t\t\t\tvalues = opts and opts.values or {},',
	'\t\t\t\t\tSelect = function(self, val, skip)',
	'\t\t\t\t\t\tself.selected = val',
	'\t\t\t\t\t\tif not skip and opts and opts.callback then pcall(opts.callback, val) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tSetValues = function(self, vals) self.values = vals or {} end,',
	'\t\t\t\t\tAddValue = function(self, val) table.insert(self.values, val) end,',
	'\t\t\t\t\tRemoveValue = function(self, val)',
	'\t\t\t\t\t\tfor i, v in ipairs(self.values) do',
	'\t\t\t\t\t\t\tif v == val then table.remove(self.values, i) break end',
	'\t\t\t\t\t\tend',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tClearValues = function(self) table.clear(self.values) end,',
	'\t\t\t\t\tSetText = function(self, str) end,',
	'\t\t\t\t}',
	'\t\t\t\treturn list',
	'\t\t\tend',
	'\t\t\tfunction sec:AddBox(opts)',
	'\t\t\t\tlocal box = {',
	'\t\t\t\t\tinput = opts and (opts.input or opts.default) or "",',
	'\t\t\t\t\tSetInput = function(self, str, skip)',
	'\t\t\t\t\t\tself.input = str',
	'\t\t\t\t\t\tif not skip and opts and opts.callback then pcall(opts.callback, str) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tSetText = function(self, str) end,',
	'\t\t\t\t\tCaptureFocus = function() end,',
	'\t\t\t\t\tReleaseFocus = function() end,',
	'\t\t\t\t}',
	'\t\t\t\treturn box',
	'\t\t\tend',
	'\t\t\tfunction sec:AddBind(opts)',
	'\t\t\t\tlocal bind = {',
	'\t\t\t\t\tbind = opts and opts.default or "None",',
	'\t\t\t\t\tstate = false,',
	'\t\t\t\t\tSetBind = function(self, keybind)',
	'\t\t\t\t\t\tself.bind = keybind',
	'\t\t\t\t\t\tif opts and opts.keycallback then pcall(opts.keycallback, keybind) end',
	'\t\t\t\t\tend,',
	'\t\t\t\t\tSetText = function(self, str) end,',
	'\t\t\t\t\tSetKeyText = function(self, str) end,',
	'\t\t\t\t}',
	'\t\t\t\treturn bind',
	'\t\t\tend',
	'\t\t\tfunction sec:AddScrollList(opts)',
	'\t\t\t\tlocal scrolllist = sec:AddList(opts)',
	'\t\t\t\tscrolllist.SetVisibleCount = function() end',
	'\t\t\t\tscrolllist.AutoFill = function() end',
	'\t\t\t\tscrolllist.Refresh = function() end',
	'\t\t\t\treturn scrolllist',
	'\t\t\tend',
	'\t\t\tfunction sec:AddColor() return { SetColor = function() end } end',
	'\t\t\tfunction sec:AddKeyPicker() return { SetKey = function() end } end',
	'\t\t\tfunction sec:AddButton(opts) return { SetText = function() end } end',
	'\t\t\tfunction sec:AddText(opts) return { SetText = function() end } end',
	'\t\t\tfunction sec:AddSearchBox(opts) return sec:AddBox(opts) end',
	'\t\t\tfunction sec:AddDivider() end',
	'\t\t\tfunction sec:AddSeparator() end',
	'\t\t\tfunction sec:SetText() end',
	'\t\t\tfunction sec:SetEnabled() end',
	'\t\t\tfunction sec:UpdateOptions() end',
	'\t\t\treturn sec',
	'\t\tend',
	'',
	'\t\tlocal function createMockTab(tabName)',
	'\t\t\tlocal t = { name = tabName, sections = {} }',
	'\t\t\tfunction t:AddSubTabs() end',
	'\t\t\tfunction t:AddLeftTabbox()',
	'\t\t\t\treturn {',
	'\t\t\t\t\tAddTab = function(self, title) return self:AddSection(title) end,',
	'\t\t\t\t\tAddSection = function(self, secName)',
	'\t\t\t\t\t\tlocal s = createMockSection(secName)',
	'\t\t\t\t\t\tt.sections[secName] = s',
	'\t\t\t\t\t\treturn s',
	'\t\t\t\t\tend,',
	'\t\t\t\t}',
	'\t\t\tend',
	'\t\t\tfunction t:AddRightTabbox() return self:AddLeftTabbox() end',
	'\t\t\tfunction t:AddSection(secName)',
	'\t\t\t\tlocal s = createMockSection(secName)',
	'\t\t\t\tt.sections[secName] = s',
	'\t\t\t\treturn s',
	'\t\t\tend',
	'\t\t\treturn t',
	'\t\tend',
	'',
	'\t\tlocal mockLib = {',
	'\t\t\tcurrentTheme = "Default",',
	'\t\t\toptions = {},',
	'\t\t\tthemes = { { theme = {} } },',
	'\t\t\topen = false,',
	'\t\t\tinit = function(self) end,',
	'\t\t\tSetOpen = function(self, val) self.open = val end,',
	'\t\t\tSelectTheme = function(self) end,',
	'\t\t\tSetTheme = function(self) end,',
	'\t\t\tSendNotification = function(self, msg) print("[Atomware]", msg) end,',
	'\t\t\tCreateSettingsTab = function(self, menu)',
	'\t\t\t\tlocal sTab = nil',
	'\t\t\t\tif type(_G.AtomwareWindow) == "table" and type(_G.AtomwareWindow.CreateSettingsTab) == "function" then',
	'\t\t\t\t\tsTab = _G.AtomwareWindow:CreateSettingsTab(menu)',
	'\t\t\t\telse',
	'\t\t\t\t\tsTab = createMockTab("settings")',
	'\t\t\t\t\tsTab.UpdateSections = function() end',
	'\t\t\t\tend',
	'\t\t\t\tDrawingBridge.settingsTab = sTab',
	'\t\t\t\treturn sTab',
	'\t\t\tend,',
	'\t\t\tNewWindow = function(spec)',
	'\t\t\t\tif type(_G.AtomwareWindow) == "table" and type(_G.AtomwareWindow.AddTab) == "function" then',
	'\t\t\t\t\treturn _G.AtomwareWindow',
	'\t\t\t\tend',
	'\t\t\t\tlocal win = { tabs = {} }',
	'\t\t\t\tfunction win:AddTab(name)',
	'\t\t\t\t\tlocal tab = createMockTab(name)',
	'\t\t\t\t\twin.tabs[name] = tab',
	'\t\t\t\t\treturn tab',
	'\t\t\t\tend',
	'\t\t\t\tfunction win:UpdateTabs() end',
	'\t\t\t\tfunction win:SelectTab() end',
	'\t\t\t\treturn win',
	'\t\t\tend,',
	'\t\t}',
	'\t\treturn mockLib',
	'\tend'
];

lines.splice(loadDrawingIdx, 1, ...mockLibraryCode);
console.log('Injected mockLibrary at line:', loadDrawingIdx + 1);

// 2. In installDrawingMenu, conditionally skip heavy builders in Lite mode
let buildersIdx = -1;
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('for _, key in { "combat", "esp", "world", "cosmetics", "lua" } do')) {
		buildersIdx = i;
		break;
	}
}

if (buildersIdx === -1) {
	console.error('Could not find builders loop in source!');
	process.exit(1);
}

const newBuildersCode = [
	'\t\tlocal activeBuilders = if _G.AtomwareLiteMode == true then { "combat", "esp", "world" } else { "combat", "esp", "world", "cosmetics", "lua" }',
	'\t\tfor _, key in activeBuilders do',
	'\t\t\tlocal builder = DrawingBridge.builders[key]',
	'\t\t\tif builder then',
	'\t\t\t\tlocal okBuild, _buildErr = pcall(builder, DKit)',
	'\t\t\t\tif not okBuild then',
	'\t\t\t\t\twarn(key .. " section faceplanted: " .. tostring(_buildErr))',
	'\t\t\t\tend',
	'\t\t\tend',
	'\t\tend'
];

lines.splice(buildersIdx, 9, ...newBuildersCode);
console.log('Replaced builders loop at line:', buildersIdx + 1);

// 3. Expose Silent, Aim, Trigger, Movement, Exploits, Rage onto DrawingBridge
let featureStatesIdx = -1;
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('DrawingBridge.featureStates = { Aim, Silent, Trigger, Flick, Rage, Movement, Exploits }')) {
		featureStatesIdx = i;
		break;
	}
}

if (featureStatesIdx === -1) {
	console.error('Could not find DrawingBridge.featureStates in source!');
	process.exit(1);
}

const exposedBridgeCode = [
	'\tDrawingBridge.featureStates = { Aim, Silent, Trigger, Flick, Rage, Movement, Exploits }',
	'\tDrawingBridge.Aim = Aim',
	'\tDrawingBridge.Silent = Silent',
	'\tDrawingBridge.Trigger = Trigger',
	'\tDrawingBridge.Flick = Flick',
	'\tDrawingBridge.Rage = Rage',
	'\tDrawingBridge.Movement = Movement',
	'\tDrawingBridge.Exploits = Exploits',
	'\tpcall(function()',
	'\t\tlocal g = _G :: any',
	'\t\tg.__sonata_bridge = DrawingBridge',
	'\t\tg.__sonata_aim = Aim',
	'\t\tg.__sonata_silent = Silent',
	'\t\tg.__sonata_esp = DrawingBridge.Esp',
	'\t\tg.__sonata_movement = Movement',
	'\t\tg.__sonata_exploits = Exploits',
	'\tend)'
];

lines.splice(featureStatesIdx, 1, ...exposedBridgeCode);
console.log('Exposed bridge states at line:', featureStatesIdx + 1);

// 4. Append Universal UI Event Adapter & Hitbox Expander loop at the very end
const tailCode = `
--//==================================================
--// ATOMWARE RIVALS - UNIVERSAL UI EVENT ADAPTER
--// Supports PC UI (main_ui.lua), Mobile UI (mobile_ui.lua),
--// and Mobile Lite UI (mobile_lite_ui.lua)
--//==================================================
do
	local Players = game:GetService("Players")
	local RunService = game:GetService("RunService")
	local Lighting = game:GetService("Lighting")
	local LocalPlayer = Players.LocalPlayer

	local bridge: any = DrawingBridge
	local Silent: any = bridge and bridge.Silent
	local Aim: any = bridge and bridge.Aim
	local Trigger: any = bridge and bridge.Trigger
	local Movement: any = bridge and bridge.Movement
	local Exploits: any = bridge and bridge.Exploits
	local Esp: any = bridge and bridge.Esp

	-- Hitbox Expander Runtime Loop
	_G.__HitboxExpanderEnabled = false
	_G.__HitboxSize = 8
	_G.__HitboxTargetPart = "Head"
	_G.__HitboxTransparency = 0.5
	local originalSizes = {}

	RunService.Heartbeat:Connect(function()
		if not _G.__HitboxExpanderEnabled then return end
		local targetPartName = _G.__HitboxTargetPart or "Head"
		local size = _G.__HitboxSize or 8
		local trans = _G.__HitboxTransparency or 0.5
		for _, player in ipairs(Players:GetPlayers()) do
			if player ~= LocalPlayer and player.Character then
				local char = player.Character
				local part = char:FindFirstChild(targetPartName)
				if not part and targetPartName == "Head" then
					part = char:FindFirstChild("HitboxHead")
				elseif not part and (targetPartName == "Torso" or targetPartName == "UpperTorso") then
					part = char:FindFirstChild("UpperTorso") or char:FindFirstChild("HumanoidRootPart") or char:FindFirstChild("Torso")
				end
				if part and part:IsA("BasePart") then
					if not originalSizes[part] then
						originalSizes[part] = part.Size
					end
					part.Size = Vector3.new(size, size, size)
					part.Transparency = trans
					part.CanCollide = false
				end
			end
		end
	end)

	local function resetHitboxes()
		for part, size in pairs(originalSizes) do
			if part and part.Parent then
				pcall(function()
					part.Size = size
					part.Transparency = 0
				end)
			end
		end
		table.clear(originalSizes)
	end

	-- Connect UI Events across all PC & Mobile UI Frameworks
	if _G.OnToggle then
		-- =========================================================
		-- COMBAT: SILENT AIM
		-- =========================================================
		_G.OnToggle("Enable Silent Aim", function(v)
			if Silent then Silent.enabled = (v == true) end
		end)
		_G.OnToggle("Show Silent FOV Circle", function(v)
			if Silent then Silent.drawFov = (v == true) end
		end)
		_G.OnToggle("Silent Team Check", function(v)
			if Silent then Silent.teamCheck = (v == true) end
		end)
		_G.OnToggle("Silent Wall Check", function(v)
			if Silent then Silent.visibleCheck = (v == true) end
		end)
		_G.OnSlider("Silent Aim Hit Chance", function(v)
			if Silent then Silent.accuracy = tonumber(v) or 100 end
		end)
		_G.OnSlider("Silent Aim FOV", function(v)
			if Silent then Silent.fov = tonumber(v) or 120 end
		end)
		_G.OnDropdown("Silent Target Part", function(v)
			if Silent then
				if v == "Head" or v == "Torso" then
					Silent.hitPart = v
				elseif v == "Closest" then
					Silent.hitPart = "Head"
				end
			end
		end)
		if _G.OnColorPicker then
			_G.OnColorPicker("Silent FOV Color", function(c3)
				if Silent then Silent.fovColor1 = c3 end
			end)
		end

		-- =========================================================
		-- COMBAT: AIMBOT
		-- =========================================================
		_G.OnToggle("Enable Aimbot", function(v)
			if Aim then Aim.enabled = (v == true) end
		end)
		_G.OnToggle("Show Aimbot FOV Circle", function(v)
			if Aim then Aim.drawFov = (v == true) end
		end)
		_G.OnToggle("Aimbot Team Check", function(v)
			if Aim then Aim.teamCheck = (v == true) end
		end)
		_G.OnToggle("Aimbot Wall Check", function(v)
			if Aim then Aim.visibleCheck = (v == true) end
		end)
		_G.OnSlider("Aimbot Smoothness", function(v)
			if Aim then Aim.smooth = tonumber(v) or 4 end
		end)
		_G.OnSlider("Aimbot FOV", function(v)
			if Aim then Aim.fov = tonumber(v) or 140 end
		end)
		_G.OnDropdown("Aimbot Mode", function(v)
			if Aim then
				if v == "Always On" or v == "Always" then
					Aim.keyName = "None"
				else
					Aim.keyName = v
				end
			end
		end)
		_G.OnDropdown("Aimbot Target Part", function(v)
			if Aim then
				Aim.hitboxes = {
					Head = (v == "Head" or v == "Closest"),
					Torso = (v == "Torso"),
					UpperTorso = (v == "Torso"),
					LowerTorso = (v == "Torso"),
					HumanoidRootPart = false,
				}
			end
		end)
		if _G.OnKeybind then
			_G.OnKeybind("Aimbot Key", function(k)
				if Aim then Aim.keyName = tostring(k) end
			end)
		end
		if _G.OnColorPicker then
			_G.OnColorPicker("Aimbot FOV Color", function(c3)
				if Aim then Aim.fovColor1 = c3 end
			end)
		end

		-- =========================================================
		-- COMBAT: TRIGGERBOT
		-- =========================================================
		_G.OnToggle("Enable Triggerbot", function(v)
			if Trigger then Trigger.enabled = (v == true) end
		end)
		_G.OnSlider("Triggerbot Delay", function(v)
			if Trigger then Trigger.delay = (tonumber(v) or 50) / 1000 end
		end)
		_G.OnToggle("Triggerbot Team Check", function(v)
			if Trigger then Trigger.teamCheck = (v == true) end
		end)
		_G.OnToggle("Triggerbot Headshot Only", function(v)
			if Trigger then Trigger.headOnly = (v == true) end
		end)

		-- =========================================================
		-- COMBAT: HITBOX EXPANDER
		-- =========================================================
		_G.OnToggle("Enable Hitbox Expander", function(v)
			_G.__HitboxExpanderEnabled = (v == true)
			if not v then resetHitboxes() end
		end)
		_G.OnSlider("Hitbox Size", function(v)
			_G.__HitboxSize = tonumber(v) or 8
		end)
		_G.OnSlider("Hitbox Transparency", function(v)
			_G.__HitboxTransparency = (tonumber(v) or 50) / 100
		end)
		_G.OnDropdown("Hitbox Target", function(v)
			_G.__HitboxTargetPart = v or "Head"
		end)
		_G.OnDropdown("Hitbox Part", function(v)
			_G.__HitboxTargetPart = v or "Head"
		end)

		-- =========================================================
		-- VISUALS: ESP
		-- =========================================================
		_G.OnToggle("Enable ESP", function(v)
			if Esp then
				Esp.master = (v == true)
				Esp.enabled = (v == true)
			end
		end)
		_G.OnToggle("Box ESP", function(v)
			if Esp then
				Esp.box = (v == true)
				Esp.boxOutline = (v == true)
			end
		end)
		_G.OnToggle("Box Fill", function(v)
			if Esp then Esp.boxFill = (v == true) end
		end)
		_G.OnToggle("Health Bar", function(v)
			if Esp then Esp.health = (v == true) end
		end)
		_G.OnToggle("Name ESP", function(v)
			if Esp then Esp.names = (v == true) end
		end)
		_G.OnToggle("Distance ESP", function(v)
			if Esp then Esp.distance = (v == true) end
		end)
		_G.OnToggle("Weapon ESP", function(v)
			if Esp then Esp.weapon = (v == true) end
		end)
		_G.OnToggle("Skeleton ESP", function(v)
			if Esp then
				Esp.skeleton = (v == true)
				Esp.skeletonOutline = (v == true)
			end
		end)
		_G.OnToggle("Snaplines", function(v)
			if Esp then Esp.snaplines = (v == true) end
		end)
		_G.OnToggle("Chams / Highlights", function(v)
			if Esp then Esp.chams = (v == true) end
		end)
		_G.OnToggle("Team Check", function(v)
			if Esp then
				Esp.teamCheck = (v == true)
				Esp.enemyOnly = (v == true)
			end
		end)
		_G.OnSlider("Max ESP Distance", function(v)
			if Esp then Esp.maxDistance = tonumber(v) or 1000 end
		end)
		if _G.OnColorPicker then
			_G.OnColorPicker("Box Color", function(c3) if Esp then Esp.boxColor = c3 end end)
			_G.OnColorPicker("Box Fill Color", function(c3) if Esp then Esp.boxFillColor = c3 end end)
			_G.OnColorPicker("Skeleton Color", function(c3) if Esp then Esp.skeletonColor = c3 end end)
			_G.OnColorPicker("Snapline Color", function(c3) if Esp then Esp.snaplinesColor = c3 end end)
			_G.OnColorPicker("Text Color", function(c3)
				if Esp then
					Esp.namesColor = c3
					Esp.distanceColor = c3
					Esp.weaponColor = c3
				end
			end)
		end

		-- =========================================================
		-- WORLD & LIGHTING
		-- =========================================================
		_G.OnToggle("Fullbright", function(v)
			if v then
				Lighting.Brightness = 2
				Lighting.ClockTime = 14
				Lighting.GlobalShadows = false
				Lighting.OutdoorAmbient = Color3.fromRGB(128, 128, 128)
			end
		end)
		_G.OnSlider("Brightness", function(v)
			Lighting.Brightness = tonumber(v) or 2
		end)
		_G.OnToggle("Remove Shadows", function(v)
			Lighting.GlobalShadows = not v
		end)
		_G.OnToggle("Clear Atmosphere / Fog", function(v)
			if v then
				Lighting.FogEnd = 100000
				for _, child in ipairs(Lighting:GetChildren()) do
					if child:IsA("Atmosphere") or child:IsA("BloomEffect") or child:IsA("ColorCorrectionEffect") then
						child.Enabled = false
					end
				end
			end
		end)
		_G.OnSlider("World Time of Day", function(v)
			Lighting.ClockTime = tonumber(v) or 14
		end)
		_G.OnToggle("Custom Camera FOV", function(v)
			_G.__CustomFovEnabled = (v == true)
			if not v and workspace.CurrentCamera then
				workspace.CurrentCamera.FieldOfView = 70
			end
		end)
		_G.OnSlider("Camera FOV", function(v)
			_G.__CustomFovVal = tonumber(v) or 90
			if _G.__CustomFovEnabled and workspace.CurrentCamera then
				workspace.CurrentCamera.FieldOfView = _G.__CustomFovVal
			end
		end)

		-- =========================================================
		-- PLAYER & MOVEMENT
		-- =========================================================
		_G.OnToggle("Speed Multiplier", function(v)
			if Movement then Movement.speed = (v == true) end
		end)
		_G.OnSlider("WalkSpeed", function(v)
			if Movement then Movement.walkMulti = math.clamp((tonumber(v) or 24) / 16, 0.5, 8) end
		end)
		_G.OnToggle("Infinite Jump", function(v)
			if Movement then Movement.infJump = (v == true) end
		end)
		_G.OnToggle("Bunny Hop", function(v)
			if Movement then Movement.bhop = (v == true) end
		end)
		_G.OnToggle("Fly", function(v)
			if Movement then Movement.fly = (v == true) end
		end)
		_G.OnSlider("Fly Speed", function(v)
			if Movement then Movement.flySpeed = tonumber(v) or 50 end
		end)
		_G.OnToggle("Noclip", function(v)
			if Movement then Movement.noclip = (v == true) end
		end)
	end
end

_G.AtomwareFeaturesLoaded = true
print("[Atomware Rivals] Authoritative Features Backend Loaded Successfully (PC, Mobile, and Lite Compatible)!")
`;



const newline = isCRLF ? '\r\n' : '\n';
let outputContent = lines.join(newline) + newline + tailCode;

// Universal Duel Fallbacks for Casual, Lobby, FFA, and Shooting Range
// Ensures ESP, Aimbot, and Silent Aim target living players even when not in an active 1v1 duel
const nl = newline;
const r1Old = `\t\tDrawingBridge.inGameMatch = false${nl}\t\treturn false`;
const r1New = `\t\tif lp and lp.Character and lp.Character:FindFirstChild("Humanoid") then${nl}\t\t\tinGameMatchCached = true${nl}\t\t\tDrawingBridge.inGameMatch = true${nl}\t\t\treturn true${nl}\t\tend${nl}\t\tDrawingBridge.inGameMatch = false${nl}\t\treturn false`;
if (outputContent.includes(r1Old)) {
	outputContent = outputContent.replace(r1Old, r1New);
	console.log('Applied isInGameMatch Character fallback');
}

const r2Old = `\t\t\tsilentInMatch = duel ~= nil${nl}\t\t\tif not duel then${nl}\t\t\t\treturn false${nl}\t\t\tend`;
const r2New = `\t\t\tsilentInMatch = duel ~= nil${nl}\t\t\tif not duel then${nl}\t\t\t\tfor _, player in ipairs(Players:GetPlayers()) do${nl}\t\t\t\t\tif player ~= lp then${nl}\t\t\t\t\t\tsilentEnemyOf[player] = true${nl}\t\t\t\t\tend${nl}\t\t\t\tend${nl}\t\t\t\treturn true${nl}\t\t\tend`;
if (outputContent.includes(r2Old)) {
	outputContent = outputContent.replace(r2Old, r2New);
	console.log('Applied refreshSilentRoster all-player fallback');
}

const r3Old = `\t\t\tif not duel then${nl}\t\t\t\treturn nil, nil${nl}\t\t\tend`;
const r3New = `\t\t\tif not duel then${nl}\t\t\t\treturn livingCharacter(player)${nl}\t\t\tend`;
if (outputContent.includes(r3Old)) {
	outputContent = outputContent.replace(r3Old, r3New);
	console.log('Applied livingEnemy livingCharacter fallback');
}

const r4Old = `local duel, team = matchEnemies()${nl}\t\t\tif not camera or not duel then`;
const r4New = `local duel, team = matchEnemies()${nl}\t\t\tif not camera then`;
if (outputContent.includes(r4Old)) {
	outputContent = outputContent.replace(r4Old, r4New);
	console.log('Applied ESP RenderStepped camera/duel check');
}

const r5Old = `\t\t\tif inGame and Aim.enabled and aimHeld and type(moveMouse) == "function" then`;
const r5New = `\t\t\tlocal canAim = inGame and Aim.enabled and (aimHeld or Aim.keyName == "None" or (UserInputService and UserInputService.TouchEnabled))${nl}\t\t\tif canAim then`;
if (outputContent.includes(r5Old)) {
	outputContent = outputContent.replace(r5Old, r5New);
	console.log('Applied canAim Mobile/Touch Aimbot fallback');
}

const r6Old = `\t\t\t\t\t\t\tpcall(moveMouse, mx + jx, my + jy)`;
const r6New = `\t\t\t\t\t\t\tif type(moveMouse) == "function" then${nl}\t\t\t\t\t\t\t\tpcall(moveMouse, mx + jx, my + jy)${nl}\t\t\t\t\t\t\telseif cam then${nl}\t\t\t\t\t\t\t\tlocal currentCF = cam.CFrame${nl}\t\t\t\t\t\t\t\tlocal targetCF = CFrame.lookAt(currentCF.Position, worldPos)${nl}\t\t\t\t\t\t\t\tlocal smoothVal = math.clamp(resolvedSmooth, 1, 40)${nl}\t\t\t\t\t\t\t\tlocal lerpFactor = math.clamp(1 / smoothVal, 0.05, 0.95)${nl}\t\t\t\t\t\t\t\tcam.CFrame = currentCF:Lerp(targetCF, lerpFactor)${nl}\t\t\t\t\t\t\tend`;
if (outputContent.includes(r6Old)) {
	outputContent = outputContent.replace(r6Old, r6New);
	console.log('Applied Camera CFrame Mobile Aimbot fallback');
}

const r7Old = `local function installSignalGuard()`;
const r7New = `local function installSignalGuard()${nl}\tif _G.AtomwareLiteMode == true then return end`;
if (outputContent.includes(r7Old)) {
	outputContent = outputContent.replace(r7Old, r7New);
	console.log('Applied installSignalGuard Lite Mode bypass');
}

fs.writeFileSync(destPath, outputContent, 'utf8');
console.log('Successfully wrote universal features.lua to:', destPath);
console.log('Final line count:', outputContent.split(/\r?\n/).length);
