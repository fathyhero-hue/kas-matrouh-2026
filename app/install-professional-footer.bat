@echo off
setlocal
cd /d "%~dp0"

if not exist app (
  echo ERROR: Please extract this package into the project root first.
  echo Expected root example: C:\Users\HERO\tournament-app2
  pause
  exit /b 1
)

if not exist update-files (
  echo ERROR: update-files folder is missing.
  pause
  exit /b 1
)

if not exist backup-before-professional-footer mkdir backup-before-professional-footer

if exist app\layout.tsx copy /Y app\layout.tsx backup-before-professional-footer\layout.tsx.bak >nul
if exist app\page.tsx copy /Y app\page.tsx backup-before-professional-footer\page.tsx.bak >nul
if exist components\SiteFooter.tsx copy /Y components\SiteFooter.tsx backup-before-professional-footer\SiteFooter.tsx.bak >nul

if not exist components mkdir components
copy /Y update-files\components\SiteFooter.tsx components\SiteFooter.tsx >nul
copy /Y update-files\app\layout.tsx app\layout.tsx >nul

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\remove-old-home-footer.ps1"

if errorlevel 1 (
  echo.
  echo WARNING: Could not remove the old home footer automatically.
  echo You can remove it manually from app\page.tsx by searching for: FOOTER or إدارة المنصة
)

echo.
echo DONE: Professional footer installed.
echo Backup folder: backup-before-professional-footer
echo.
echo Run:
echo npm run dev -- -p 3001
echo.
pause
