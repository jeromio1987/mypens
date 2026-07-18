@echo off
REM One-shot local arrange for MY PENS weekly loop + Garmin dump.
REM Run from the repo root (e.g. mypens-feedback-test).
REM
REM Usage:
REM   scripts\arrange-all.cmd
REM   scripts\arrange-all.cmd "C:\path\to\ba80da99-...._1"

setlocal
cd /d "%~dp0\.."

if not exist ".env" (
  echo ERROR: .env missing in %CD%
  exit /b 1
)

set "DUMP=%~1"
if "%DUMP%"=="" (
  REM Default: UUID dump folder next to this repo, or common name inside repo
  if exist "ba80da99-886a-4f1b-989e-e41afa51d239_1\" set "DUMP=%CD%\ba80da99-886a-4f1b-989e-e41afa51d239_1"
)

if not "%DUMP%"=="" (
  echo === 1/3 Import Garmin dump ===
  python scripts\import-garmin-dump.py "%DUMP%"
  if errorlevel 1 (
    echo Garmin dump import had issues — continuing to weekly feedback anyway.
  )
) else (
  echo === 1/3 Skip Garmin dump ^(pass folder path as argument^) ===
)

if exist "C:\Users\jerom\Desktop\claude\ISZE\05_memory\briefs\feedback_history\" (
  set "PENS_ISZE_FEEDBACK_DIR=C:\Users\jerom\Desktop\claude\ISZE\05_memory\briefs\feedback_history"
)

echo === 2/4 Garmin Analysis Engine ===
call npm run analyze:garmin -- --all
if errorlevel 1 (
  echo Garmin analyze had issues — continuing.
)

echo === 3/4 Generate weekly feedback ===
call npm run feedback:weekly
if errorlevel 1 (
  echo Weekly feedback failed.
  exit /b 1
)

echo === 4/4 Done ===
echo Open http://localhost:5050/weekly-feedback  ^(start with: npx next dev -p 5050^)
echo.
endlocal
