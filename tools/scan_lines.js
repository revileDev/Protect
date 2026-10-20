const fs = require('fs');
const content = fs.readFileSync('assembled_debug.lua', 'utf8');
const lines = content.split('\n');

// Find all lines that might have "Argument 1 missing or nil"
// In Roblox C++ engine, methods like Service:Method(...) or Instance:Method(...) or Global(arg) throw:
// "Argument 1 missing or nil"
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Look around 1550-1580
  if (lineNum >= 1540 && lineNum <= 1580) {
    console.log(`${lineNum}: ${line}`);
  }
}
