@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "PROJECT=%CD%"
set "SRC=%PROJECT%\UPDATE_FILES"

if not exist "%PROJECT%\package.json" (
  echo.
  echo [ERROR] شغل الملف ده من داخل فولدر المشروع الرئيسي اللي فيه package.json
  echo مثال: C:\Users\HERO\tournament-app2
  echo.
  pause
  exit /b 1
)

if not exist "%SRC%\app\page.tsx" (
  echo.
  echo [ERROR] فولدر UPDATE_FILES مش موجود جنب ملف التثبيت.
  echo فك الضغط بالكامل داخل فولدر المشروع ثم شغل install-knockout-update.bat
  echo.
  pause
  exit /b 1
)

set "APPBASE=%PROJECT%\app"
if exist "%PROJECT%\src\app\page.tsx" set "APPBASE=%PROJECT%\src\app"

if not exist "%APPBASE%" (
  echo.
  echo [ERROR] لم أجد app أو src\app داخل المشروع.
  echo ابحث عن page.tsx يدويًا بالأمر: dir /s /b page.tsx
  echo.
  pause
  exit /b 1
)

if not exist "%APPBASE%\admin" mkdir "%APPBASE%\admin"
if not exist "%PROJECT%\backup-before-knockout" mkdir "%PROJECT%\backup-before-knockout"

if exist "%APPBASE%\page.tsx" copy /Y "%APPBASE%\page.tsx" "%PROJECT%\backup-before-knockout\home-page-before-knockout.tsx" >nul
if exist "%APPBASE%\admin\page.tsx" copy /Y "%APPBASE%\admin\page.tsx" "%PROJECT%\backup-before-knockout\admin-page-before-knockout.tsx" >nul

copy /Y "%SRC%\app\page.tsx" "%APPBASE%\page.tsx" >nul
copy /Y "%SRC%\app\admin\page.tsx" "%APPBASE%\admin\page.tsx" >nul

echo.
echo [OK] تم استبدال الصفحة الرئيسية وصفحة الإدارة.
echo المسار المستخدم: %APPBASE%
echo النسخة الاحتياطية: %PROJECT%\backup-before-knockout
echo.
echo اقفل npm run dev وشغله من جديد:
echo Ctrl + C
echo npm run dev
echo.
pause
