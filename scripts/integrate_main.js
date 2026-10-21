const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'message (1).txt');
const destPath = path.join(__dirname, 'rivals', 'features.lua');

console.log('Reading main source from:', srcPath);
const raw = fs.readFileSync(srcPath, 'utf8');
const isCRLF = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

console.log('Total input lines:', lines.length, 'isCRLF:', isCRLF);

// 1. In loadDrawingLibrary, prepend mock library
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
	'\tif _G.AtomwareLiteMode == true then',
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
	'\t\t\tfunction sec:AddColor() return { SetColor = function() end } end',
	'\t\t\tfunction sec:AddKeyPicker() return { SetKey = function() end } end',
	'\t\t\tfunction sec:AddButton() end',
	'\t\t\tfunction sec:AddText() end',
	'\t\t\tfunction sec:AddSearchBox() end',
	'\t\t\tfunction sec:AddDivider() end',
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
	'\t\t\tSendNotification = function(self, msg) print("[Atomware Lite]", msg) end,',
	'\t\t\tCreateSettingsTab = function(self, menu)',
	'\t\t\t\tlocal sTab = createMockTab("settings")',
	'\t\t\t\tsTab.UpdateSections = function() end',
	'\t\t\t\treturn sTab',
	'\t\t\tend,',
	'\t\t\tNewWindow = function(spec)',
	'\t\t\t\tlocal win = { tabs = {} }',
	'\t\t\t\tfunction win:AddTab(name)',
	'\t\t\t\t\tlocal tab = createMockTab(name)',
	'\t\t\t\twin.tabs[name] = tab',
	'\t\t\t\t\treturn tab',
	'\t\t\tend',
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
	'\t\tlocal activeBuilders = if _G.AtomwareLiteMode == true then { "combat", "esp", "world", "configs" } else { "combat", "esp", "world", "cosmetics", "lua", "configs" }',
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
	'\t\t(_G :: any).__sonata_bridge = DrawingBridge',
	'\t\t(_G :: any).__sonata_aim = Aim',
	'\t\t(_G :: any).__sonata_silent = Silent',
	'\t\t(_G :: any).__sonata_esp = DrawingBridge.Esp',
	'\t\t(_G :: any).__sonata_movement = Movement',
	'\t\t(_G :: any).__sonata_exploits = Exploits',
	'\tend)'
];

lines.splice(featureStatesIdx, 1, ...exposedBridgeCode);
console.log('Exposed bridge states at line:', featureStatesIdx + 1);

// 4. Append Mobile Lite UI Event Adapter & Hitbox Expander loop at the very end
const tailCode = `
--//==================================================
--// ATOMWARE RIVALS - MOBILE LITE EVENT ADAPTER
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
	local originalSizes = {}

	RunService.Heartbeat:Connect(function()
		if not _G.__HitboxExpanderEnabled then return end
		local targetPartName = _G.__HitboxTargetPart or "Head"
		local size = _G.__HitboxSize or 8
		for _, player in ipairs(Players:GetPlayers()) do
			if player ~= LocalPlayer and player.Character then
				local part = player.Character:FindFirstChild(targetPartName)
				if part and part:IsA("BasePart") then
					if not originalSizes[part] then
						originalSizes[part] = part.Size
					end
					part.Size = Vector3.new(size, size, size)
					part.Transparency = 0.5
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

	-- Connect Mobile Lite UI Events
	if _G.OnToggle then
		-- Combat: Silent Aim
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

		-- Combat: Aimbot
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
				if v == "Always On" then
					Aim.keyName = "None"
				else
					Aim.keyName = v
				end
			end
		end)

		-- Combat: Hitbox Expander
		_G.OnToggle("Enable Hitbox Expander", function(v)
			_G.__HitboxExpanderEnabled = (v == true)
			if not v then resetHitboxes() end
		end)
		_G.OnSlider("Hitbox Size", function(v)
			_G.__HitboxSize = tonumber(v) or 8
		end)
		_G.OnDropdown("Hitbox Target", function(v)
			_G.__HitboxTargetPart = v or "Head"
		end)

		-- Visuals: ESP
		_G.OnToggle("Enable ESP", function(v)
			if Esp then Esp.master = (v == true) end
		end)
		_G.OnToggle("Box ESP", function(v)
			if Esp then Esp.box = (v == true) end
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
		_G.OnToggle("Snaplines", function(v)
			if Esp then Esp.snaplines = (v == true) end
		end)
		_G.OnToggle("Team Check", function(v)
			if Esp then Esp.enemyOnly = (v == true) end
		end)
		_G.OnSlider("Max ESP Distance", function(v)
			if Esp then Esp.maxDistance = tonumber(v) or 1000 end
		end)

		-- World & Movement
		_G.OnToggle("Fullbright", function(v)
			if v then
				Lighting.Brightness = 2
				Lighting.ClockTime = 14
				Lighting.GlobalShadows = false
				Lighting.OutdoorAmbient = Color3.fromRGB(128, 128, 128)
			end
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
		_G.OnToggle("Noclip", function(v)
			if Movement then Movement.noclip = (v == true) end
		end)
	end
end

_G.AtomwareFeaturesLoaded = true
print("[Atomware Rivals] Authoritative Features Backend Loaded Successfully (Lite & Full Compatible)!")
`;

const newline = isCRLF ? '\r\n' : '\n';
const outputContent = lines.join(newline) + newline + tailCode;

fs.writeFileSync(destPath, outputContent, 'utf8');
console.log('Successfully wrote authoritative features.lua to:', destPath);
console.log('Final line count:', outputContent.split(/\r?\n/).length);
