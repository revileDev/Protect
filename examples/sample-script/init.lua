-- init.lua
-- Main entry script for the modular project

local CombatModule = require("modules/combat")
local EspModule = require("modules/esp")
local MathHelper = require("utils/math_helper")

print("========================================")
print("[AeroAuth] Modular Init Script Started!")
print("[AeroAuth] Loaded Combat Version: " .. CombatModule.version)
print("[AeroAuth] Computed 5 + 10 = " .. MathHelper.add(5, 10))
print("========================================")

CombatModule.startAimbot()
EspModule.enableChams()
