@echo off
title AtomProtect Script Hub Scraper
cd /d "%~dp0"
python scraper_app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Application exited with an error or Python was not found.
    pause
)
