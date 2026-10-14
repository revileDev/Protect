-- utils/math_helper.lua
local MathHelper = {}

function MathHelper.add(a, b)
    return a + b
end

function MathHelper.lerp(a, b, t)
    return a + (b - a) * t
end

return MathHelper
