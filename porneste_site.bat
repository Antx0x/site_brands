@echo off
title Romania Brands - server local
cd /d "%~dp0site"

REM Prima rulare: instaleaza dependentele daca lipsesc
if not exist "node_modules" (
  echo Prima rulare: instalez dependentele, dureaza un minut...
  call npm install
  if errorlevel 1 (
    echo.
    echo EROARE la instalare. Verifica daca Node.js este instalat ^(nodejs.org^).
    echo.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Pornesc site-ul... se deschide singur in browser.
echo   Lasa aceasta fereastra DESCHISA cat folosesti site-ul.
echo   Ca sa opresti: inchide fereastra sau apasa Ctrl+C.
echo ============================================
echo.

call npm run dev -- --open

echo.
echo Serverul s-a oprit.
pause
