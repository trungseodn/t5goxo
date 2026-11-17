@echo off
chcp 65001 >nul
title ZTTeam Muse.ai Branding Worker (Avatar & Bia)
echo ========================================================
echo   ZTTeam - Muse.ai Branding Worker (Auto RPA Port 9222)
echo ========================================================
echo.

set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

echo [1] Kiem tra ket noi Google Chrome tai cong 9222...
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 9222 -InformationLevel Quiet" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Dang khoi chay Chrome Port 9222...
    start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\chrome-muse-profile" "https://muse.ai/"
    timeout /t 4 /nobreak >nul
) else (
    echo [OK] Google Chrome Port 9222 dang chay san sang!
)

echo [2] Khoi dong ZTTeam Muse.ai Branding Worker ket noi https://t5.goxo.us...
echo.
node scripts/ztteam_muse_branding_worker.js --target=https://t5.goxo.us --chrome-port=9222
pause
