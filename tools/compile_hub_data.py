#!/usr/bin/env python3
r"""
AtomWare Giant Hub Compiler
Parses game txt files from:
- Primary / Newest: C:\Users\Revil\Documents\New folder\New folder
- Base: C:\Users\Revil\Documents\New folder
and compiles them into an optimized Lua database: hub/modules/games_database.lua
Supports multiple scripts per game!
"""

import os
import re
import glob

DIR_BASE = r"C:\Users\Revil\Documents\New folder"
DIR_NEW = r"C:\Users\Revil\Documents\New folder\New folder"

_parent = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_FILE = os.path.join(_parent, "hub", "modules", "games_database.lua")

def escape_lua_string(s: str) -> str:
    """Escapes string safely for Lua double-quoted literal."""
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '')
    return s

def parse_game_file(fpath):
    with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    m_game = re.search(r"# Game:\s*(.+)", content)
    m_pid = re.search(r"# Place(?:/Game)? ID:\s*(\d+)", content)
    m_load = re.search(r"Loadstring:\s*\n([^\n]+)", content)
    m_title = re.search(r"Title:\s*(.+)", content)

    if m_pid and m_load:
        game_name = m_game.group(1).strip() if m_game else os.path.basename(fpath)[:-4]
        place_id = int(m_pid.group(1).strip())
        loadstring = m_load.group(1).strip()
        title = m_title.group(1).strip() if m_title else "Script"

        return {
            "place_id": place_id,
            "name": game_name,
            "title": title,
            "loadstring": loadstring,
            "file": fpath
        }
    return None

def main():
    games_map = {}

    # 1. Load NEW folder first (these are the newest, so they become Script #1)
    if os.path.exists(DIR_NEW):
        new_files = glob.glob(os.path.join(DIR_NEW, "*.txt"))
        print(f"Reading new directory: {len(new_files)} files in {DIR_NEW}")
        for f in new_files:
            g = parse_game_file(f)
            if g:
                pid = g["place_id"]
                if pid not in games_map:
                    games_map[pid] = {
                        "place_id": pid,
                        "name": g["name"],
                        "scripts": [{"title": g["title"], "loadstring": g["loadstring"]}]
                    }
                else:
                    if not any(s["loadstring"] == g["loadstring"] for s in games_map[pid]["scripts"]):
                        games_map[pid]["scripts"].append({"title": g["title"], "loadstring": g["loadstring"]})

    # 2. Load BASE folder (adds alternative scripts if different, or new games)
    if os.path.exists(DIR_BASE):
        base_files = glob.glob(os.path.join(DIR_BASE, "*.txt"))
        print(f"Reading base directory: {len(base_files)} files in {DIR_BASE}")
        multi_added = 0
        new_games_added = 0
        for f in base_files:
            g = parse_game_file(f)
            if g:
                pid = g["place_id"]
                if pid not in games_map:
                    games_map[pid] = {
                        "place_id": pid,
                        "name": g["name"],
                        "scripts": [{"title": g["title"], "loadstring": g["loadstring"]}]
                    }
                    new_games_added += 1
                else:
                    if not any(s["loadstring"] == g["loadstring"] for s in games_map[pid]["scripts"]):
                        games_map[pid]["scripts"].append({"title": g["title"], "loadstring": g["loadstring"]})
                        multi_added += 1
        print(f"-> Preserved {multi_added} alternative scripts for existing games.")
        print(f"-> Added {new_games_added} additional unique games from base folder.")

    games = list(games_map.values())
    games.sort(key=lambda x: x["name"].lower())

    multi_count = sum(1 for g in games if len(g["scripts"]) > 1)
    print(f"Total compiled games: {len(games)} unique Roblox games.")
    print(f"Games with multiple scripts: {multi_count}")

    # Generate Lua Code
    lines = [
        "--[[",
        "    AtomWare Universal Script Hub - Games Database",
        f"    Compiled: {len(games)} Supported Roblox Games ({multi_count} with multiple scripts)",
        "    Generated automatically by compile_hub_data.py",
        "--]]",
        "",
        "local GamesDatabase = {}",
        "GamesDatabase.ByPlaceId = {}",
        "GamesDatabase.List = {}",
        "",
        "local function addGame(placeId, name, title, loadstring)",
        "    local entry = GamesDatabase.ByPlaceId[placeId]",
        "    if not entry then",
        "        entry = {",
        "            PlaceId = placeId,",
        "            Name = name,",
        "            Title = title,",
        "            Loadstring = loadstring,",
        "            Scripts = {",
        "                { Title = title, Loadstring = loadstring }",
        "            }",
        "        }",
        "        GamesDatabase.ByPlaceId[placeId] = entry",
        "        table.insert(GamesDatabase.List, entry)",
        "    else",
        "        -- Append alternative script if distinct",
        "        local isDuplicate = false",
        "        for _, s in ipairs(entry.Scripts) do",
        "            if s.Loadstring == loadstring then",
        "                isDuplicate = true",
        "                break",
        "            end",
        "        end",
        "        if not isDuplicate then",
        "            table.insert(entry.Scripts, { Title = title, Loadstring = loadstring })",
        "        end",
        "    end",
        "end",
        "",
    ]

    for g in games:
        pid = g["place_id"]
        name_esc = escape_lua_string(g["name"])
        for s in g["scripts"]:
            title_esc = escape_lua_string(s["title"])
            load_esc = escape_lua_string(s["loadstring"])
            lines.append(f'addGame({pid}, "{name_esc}", "{title_esc}", "{load_esc}")')

    # Add helper search and query methods
    lines.extend([
        "",
        "--// Helper Methods",
        "function GamesDatabase:GetAll()",
        "    return self.List",
        "end",
        "",
        "function GamesDatabase:GetByPlaceId(placeId)",
        "    local id = tonumber(placeId)",
        "    if not id then return nil end",
        "    return self.ByPlaceId[id]",
        "end",
        "",
        "function GamesDatabase:Search(query, limit)",
        "    limit = limit or 50",
        "    local q = tostring(query or ''):lower():gsub('^%s*(.-)%s*$', '%1')",
        "    local results = {}",
        "    if q == '' then",
        "        for i = 1, math.min(#self.List, limit) do",
        "            table.insert(results, self.List[i])",
        "        end",
        "        return results",
        "    end",
        "",
        "    -- Direct Place ID match priority",
        "    local numQ = tonumber(q)",
        "    if numQ and self.ByPlaceId[numQ] then",
        "        table.insert(results, self.ByPlaceId[numQ])",
        "    end",
        "",
        "    -- Name search",
        "    for _, gameData in ipairs(self.List) do",
        "        if #results >= limit then break end",
        "        if gameData.PlaceId ~= numQ then",
        "            if gameData.Name:lower():find(q, 1, true) or tostring(gameData.PlaceId):find(q, 1, true) then",
        "                table.insert(results, gameData)",
        "            end",
        "        end",
        "    end",
        "    return results",
        "end",
        "",
        "return GamesDatabase"
    ])

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        out.write("\n".join(lines))

    print(f"Generated {OUTPUT_FILE} ({os.path.getsize(OUTPUT_FILE):,} bytes).")

if __name__ == "__main__":
    main()
