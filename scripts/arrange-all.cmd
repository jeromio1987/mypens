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

echo === 2/5 Garmin Analysis Engine ^(week / all^) ===
call npm run analyze:garmin -- --all
if errorlevel 1 (
  echo Garmin analyze had issues — continuing.
)

echo === 3/5 Period Review ^(3m / 6m / 12m advice^) ===
call npm run analyze:periods
if errorlevel 1 (
  echo Period review had issues — continuing.
)

echo === 4/5 Generate weekly feedback ^(this ISO week only^) ===
call npm run feedback:weekly
if errorlevel 1 (
  echo Weekly feedback failed.
  exit /b 1
)

echo === 5/5 Done ===
echo Weekly:  http://localhost:5050/weekly-feedback
echo Periods: http://localhost:5050/period-review
echo ^(start with: npx next dev -p 5050^)
echo.
endlocal
