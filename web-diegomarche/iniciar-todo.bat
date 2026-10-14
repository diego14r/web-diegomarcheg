@echo off
chcp 65001 >nul
title Libros - Iniciar
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado. Descargalo de https://nodejs.org ^(version LTS^) y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul

if not exist "backend\node_modules" (
  echo Instalando dependencias del backend...
  pushd "backend"
  call npm install
  if errorlevel 1 ( popd & goto :npmerror )
  popd
)
if not exist "frontend\node_modules" (
  echo Instalando dependencias del frontend...
  pushd "frontend"
  call npm install
  if errorlevel 1 ( popd & goto :npmerror )
  popd
)

echo.
echo Preparando la base de datos BooksDB en SQL Server ^(autenticacion de Windows^)...
pushd "backend"
call npm run crear-bd
popd

echo.
echo Iniciando backend y frontend...
start "Backend (puerto 3000)" /D "%~dp0backend" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "Frontend (puerto 5173)" /D "%~dp0frontend" cmd /k "npm run dev"
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000/health   ^(Swagger: http://localhost:3000/docs^)
echo Para detener todo, cierra las ventanas que se abrieron.
pause
exit /b 0

:npmerror
echo.
echo [ERROR] Fallo "npm install". Revisa la conexion a internet y vuelve a ejecutar este archivo.
pause
exit /b 1
