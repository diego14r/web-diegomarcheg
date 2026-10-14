@echo off
chcp 65001 >nul
title Libros - Crear base de datos en SQL Server
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado. Descargalo de https://nodejs.org ^(version LTS^) y vuelve a ejecutar.
  pause
  exit /b 1
)
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "node_modules" (
  echo Instalando dependencias del backend...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Fallo "npm install". Revisa tu conexion a internet y vuelve a ejecutar.
    pause
    exit /b 1
  )
)

echo.
echo Creando BooksDB ^(tabla, stored procedures y datos^) con la configuracion de backend\.env ...
echo.
call npm run crear-bd
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo crear la base de datos. Lee el mensaje de arriba.
  echo         Si quieres hacerlo a mano en SSMS, ejecuta en orden: sql\schema.sql, sql\procs.sql, sql\seed.sql
  pause
  exit /b 1
)
echo.
pause
exit /b 0
