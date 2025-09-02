@echo off
setlocal enabledelayedexpansion

REM Database initialization script for Game Catalog Service (Windows)
REM This script sets up the PostgreSQL database with all required tables, indexes, and initial data

REM Default values
if "%POSTGRES_HOST%"=="" set POSTGRES_HOST=localhost
if "%POSTGRES_PORT%"=="" set POSTGRES_PORT=5432
if "%POSTGRES_DB%"=="" set POSTGRES_DB=game_catalog
if "%POSTGRES_USER%"=="" set POSTGRES_USER=postgres
if "%POSTGRES_PASSWORD%"=="" set POSTGRES_PASSWORD=password

echo.
echo 🚀 Initializing Game Catalog Service Database
echo ==================================================
echo Host: %POSTGRES_HOST%:%POSTGRES_PORT%
echo Database: %POSTGRES_DB%
echo User: %POSTGRES_USER%
echo.

REM Check if PostgreSQL is running
echo 📡 Checking PostgreSQL connection...
pg_isready -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL is not running or not accessible
    echo Please ensure PostgreSQL is running and accessible at %POSTGRES_HOST%:%POSTGRES_PORT%
    exit /b 1
)
echo ✅ PostgreSQL connection successful

REM Create database if it doesn't exist
echo 🗄️  Creating database if not exists...
set PGPASSWORD=%POSTGRES_PASSWORD%
createdb -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% %POSTGRES_DB% 2>nul
echo ✅ Database ready

REM Change to project directory
cd /d "%~dp0\.."

REM Run TypeORM migrations
echo 🔄 Running TypeORM migrations...
call npm run migration:run
if errorlevel 1 (
    echo ❌ Migration failed
    exit /b 1
)
echo ✅ Migrations completed

REM Run initialization SQL script
echo 📝 Running database initialization script...
psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d %POSTGRES_DB% -f "scripts/init-database.sql"
if errorlevel 1 (
    echo ❌ Database initialization failed
    exit /b 1
)
echo ✅ Database initialization completed

REM Verify installation
echo 🔍 Verifying database setup...
for /f %%i in ('psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d %POSTGRES_DB% -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"') do set TABLE_COUNT=%%i
for /f %%i in ('psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d %POSTGRES_DB% -t -c "SELECT COUNT(*) FROM categories;"') do set CATEGORY_COUNT=%%i
for /f %%i in ('psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d %POSTGRES_DB% -t -c "SELECT COUNT(*) FROM tags;"') do set TAG_COUNT=%%i

echo Tables created: %TABLE_COUNT%
echo Categories inserted: %CATEGORY_COUNT%
echo Tags inserted: %TAG_COUNT%

if %TABLE_COUNT% gtr 10 (
    echo ✅ Database setup verification successful
) else (
    echo ❌ Database setup verification failed
    exit /b 1
)

echo.
echo 🎉 Game Catalog Service database initialization completed successfully!
echo.
echo Next steps:
echo 1. Start the application: npm run start:dev
echo 2. Check API documentation at: http://localhost:3000/api
echo 3. Test database connection with your application
echo.
echo Database connection string:
echo postgresql://%POSTGRES_USER%:%POSTGRES_PASSWORD%@%POSTGRES_HOST%:%POSTGRES_PORT%/%POSTGRES_DB%

endlocal