@echo off
title ACTIO - GitHub Sync
D:
cd D:\ACTIO

echo --- 1. ФИКСИРУЕМ ТВОИ ИЗМЕНЕНИЯ (COMMIT) ---
git add .
set /p msg="What did you change? (or press Enter): "
if "%msg%"=="" set msg="update actio %date% %time%"
git commit -m "%msg%"

echo --- 2. СИНХРОНИЗИРУЕМ С ОБЛАКОМ (PULL) ---
git pull origin main --rebase

echo --- 3. ОТПРАВЛЯЕМ НА ГИТХАБ (PUSH) ---
git push origin main

echo --- ГОТОВО! ПРОВЕРЯЙ САЙТ ---
pause