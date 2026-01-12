@echo off
echo ===============================
echo Restoring last backup...
echo ===============================

git restore .
git clean -fd

echo.
echo Restore complete.
pause
