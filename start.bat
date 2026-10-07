@echo off
setlocal
cd /d "%~dp0"

if not exist "server\dist\index.js" goto build
if not exist "client\dist\index.html" goto build
goto run

:build
echo ============================================
echo  Ilk calistirma - uygulama derleniyor.
echo  Bu birkac dakika surebilir, lutfen bekleyin...
echo ============================================
call npm run build
if errorlevel 1 (
  echo.
  echo Derleme basarisiz oldu. Yukaridaki hatayi kontrol edin.
  pause
  exit /b 1
)
echo.
echo Derleme tamamlandi.

:run
echo Sunucu baslatiliyor...
start "IT Yonetim Paneli - Sunucu" cmd /k "npm start --prefix server"

echo Tarayici aciliyor...
timeout /t 2 /nobreak >nul
start "" "http://localhost:4000"

exit /b 0
