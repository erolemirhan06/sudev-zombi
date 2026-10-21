@echo off
chcp 65001 >nul
title Oyun Katilimci Listesi & QR Yonetim Paneli
echo ========================================================
echo   🎮 Oyun Katilimci Listesi & QR Sistemi Baslatiliyor...
echo ========================================================
echo.

start "" "http://localhost:3000"
node server.js
pause
