@echo off
echo ===============================
echo Backing up Deposit Defender...
echo ===============================

git add .
git commit -m "Backup %date% %time%"

echo.
echo Backup complete.
pause
