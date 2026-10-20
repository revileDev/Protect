const fs = require('fs');
const fengari = require('fengari');
const lua = fengari.lua;
const lauxlib = fengari.lauxlib;
const lualib = fengari.lualib;

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);

// Mock Roblox environment
const mockCode = `
bit32 = {
    bxor = function(a, b) return a ~ b end,
    band = function(a, b) return a & b end,
    bor = function(a, b) return a | b end,
    bnot = function(a) return ~a end
}
bit = bit32
game = {
    PlaceId = 286090429,
    JobId = "mock_job_id",
    GetService = function(self, name)
        return {
            Name = name,
            Teleport = function() end,
            JSONEncode = function(s, v) return "{}" end,
            JSONDecode = function(s, v) return {} end,
            Create = function(s, inst, info, props)
                return { Play = function() end, Completed = { Connect = function() end } }
            end,
            RenderStepped = { Connect = function() end },
            InputBegan = { Connect = function() end },
            InputChanged = { Connect = function() end },
            GetPropertyChangedSignal = function() return { Connect = function() end } end,
        }
    end
}
workspace = {
    CurrentCamera = {
        ViewportSize = { X = 1920, Y = 1080 },
        GetPropertyChangedSignal = function() return { Connect = function() end } end
    }
}
Vector2 = { new = function(x, y) return { X = x, Y = y } end }
Vector3 = { new = function(x, y, z) return { X = x, Y = y, Z = z } end }
UDim = { new = function(s, o) return { Scale = s, Offset = o } end }
UDim2 = { new = function(sx, ox, sy, oy) return { X = { Scale = sx, Offset = ox }, Y = { Scale = sy, Offset = oy } } end }
Color3 = {
    fromRGB = function(r, g, b) return { R = r, G = g, B = b } end,
    new = function(r, g, b) return { R = r, G = g, B = b } end
}
TweenInfo = { new = function(...) return {} end }
Enum = {
    Font = { GothamBold = 1, Gotham = 2, GothamSemibold = 3 },
    EasingStyle = { Quart = 1 },
    EasingDirection = { Out = 1, In = 2 },
    UserInputType = { MouseButton1 = 1, Touch = 2, MouseMovement = 3 },
    UserInputState = { End = 1 },
    SortOrder = { LayoutOrder = 1 },
    TextXAlignment = { Left = 1, Center = 2, Right = 3 },
    TextTruncate = { AtEnd = 1 },
    AutomaticSize = { Y = 1 }
}

Instance = {
    new = function(className)
        local inst = {
            ClassName = className,
            Position = UDim2.new(0, 0, 0, 0),
            Size = UDim2.new(0, 0, 0, 0),
            MouseButton1Click = { Connect = function() end },
            InputBegan = { Connect = function() end },
            InputChanged = { Connect = function() end },
            Changed = { Connect = function() end },
            GetPropertyChangedSignal = function() return { Connect = function() end } end,
            Destroy = function() end,
            CaptureFocus = function() end,
            FindFirstChild = function(s, name) return nil end,
            WaitForChild = function(s, name)
                return Instance.new("PlayerGui")
            end
        }
        return inst
    end
}

Players = {
    LocalPlayer = {
        Name = "TestUser",
        UserId = 1234567,
        DisplayName = "TestUser",
        AccountAge = 100,
        WaitForChild = function(s, name)
            return Instance.new("PlayerGui")
        end
    }
}
game.Players = Players

tick = function() return 1000 end
os.clock = function() return 1000 end
task = {
    spawn = function(f, ...) return f(...) end,
    wait = function() end,
    delay = function(t, f) return f() end
}
`;

lauxlib.luaL_dostring(L, fengari.to_luastring(mockCode));

const payloadCode = fs.readFileSync('reproduced_payload.lua', 'utf8');
const status = lauxlib.luaL_loadstring(L, fengari.to_luastring(payloadCode));

if (status !== lua.LUA_OK) {
  console.error("LOAD ERROR:", lua.lua_tojsstring(L, -1));
} else {
  console.log("Compiled OK. Running payload...");
  const callStatus = lua.lua_pcall(L, 0, 0, 0);
  if (callStatus !== lua.LUA_OK) {
    console.error("RUNTIME ERROR:", lua.lua_tojsstring(L, -1));
  } else {
    console.log("Payload executed successfully without any errors!");
  }
}
