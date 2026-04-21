#!/usr/bin/env python3
"""
import-garmin.py — Import Garmin .fit activity files into the MY PENS SQLite database.

Usage:
    python3 scripts/import-garmin.py

Reads all .fit files from  garmin_activities/YYYY/  (already organised by year).
Skips duplicates (safe to re-run).
Writes directly to prisma/dev.db — no Prisma commands needed.

After running:
    npx prisma generate    ← regenerate Prisma client (needed once after schema change)
    npm run dev            ← restart dev server to pick up new model
"""

import os
import io
import sqlite3
import datetime
from pathlib import Path

try:
    from fitparse import FitFile
except ImportError:
    print("fitparse not found. Installing...")
    import subprocess
    subprocess.run(["pip", "install", "fitparse", "--break-system-packages", "-q"], check=True)
    from fitparse import FitFile

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT   = SCRIPT_DIR.parent
DB_PATH     = REPO_ROOT / "prisma" / "dev.db"
ACTIVITIES  = REPO_ROOT / "garmin_activities"

if not DB_PATH.exists():
    print(f"ERROR: Database not found at {DB_PATH}")
    print("Run 'npx prisma migrate dev' or 'npx prisma db push' first to create it.")
    exit(1)

if not ACTIVITIES.exists():
    print(f"ERROR: garmin_activities/ folder not found at {ACTIVITIES}")
    exit(1)

# ── Database setup ─────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

cur.execute("""
    CREATE TABLE IF NOT EXISTS GarminActivity (
        id          TEXT PRIMARY KEY,
        createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
        fitFileId   TEXT NOT NULL UNIQUE,
        date        TEXT NOT NULL,
        name        TEXT NOT NULL,
        sport       TEXT NOT NULL,
        subSport    TEXT,
        durationSec REAL NOT NULL,
        distanceM   REAL,
        elevationM  REAL,
        avgHr       INTEGER,
        maxHr       INTEGER,
        calories    INTEGER,
        avgSpeedMs  REAL,
        maxSpeedMs  REAL
    )
""")
conn.commit()

# ── Helpers ────────────────────────────────────────────────────────────────────
def cuid_like(fit_file_id: str) -> str:
    """Generate a stable pseudo-cuid from the fit file ID."""
    import hashlib
    h = hashlib.sha256(fit_file_id.encode()).hexdigest()
    return f"garmin_{h[:20]}"

def parse_fit(fit_path: Path):
    """
    Parse a .fit file and return a dict of activity data, or None if not an activity.
    fitparse returns values in SI units: distance=metres, speed=m/s, time=seconds.
    """
    with open(fit_path, "rb") as f:
        data = f.read()

    ff = FitFile(io.BytesIO(data))

    # Check file type
    file_type = None
    for msg in ff.get_messages("file_id"):
        for field in msg.fields:
            if field.name == "type":
                file_type = str(field.value)
        break

    if file_type != "activity":
        return None

    # Extract session data (first session message)
    result = {
        "sport": "unknown",
        "subSport": None,
        "durationSec": 0.0,
        "distanceM": None,
        "elevationM": None,
        "avgHr": None,
        "maxHr": None,
        "calories": None,
        "avgSpeedMs": None,
        "maxSpeedMs": None,
        "startTime": None,
    }

    for msg in ff.get_messages("session"):
        fields = {f.name: f.value for f in msg.fields}

        # Sport
        sport = fields.get("sport")
        if sport:
            result["sport"] = str(sport).lower()
        sub = fields.get("sub_sport")
        if sub and str(sub).lower() not in ("generic", "none"):
            result["subSport"] = str(sub).lower()

        # Timing
        elapsed = fields.get("total_elapsed_time")
        if elapsed is not None:
            result["durationSec"] = float(elapsed)

        start = fields.get("start_time")
        if start:
            result["startTime"] = start

        # Distance (fitparse gives metres)
        dist = fields.get("total_distance")
        if dist is not None and float(dist) > 0:
            result["distanceM"] = round(float(dist), 1)

        # Elevation (fitparse gives metres)
        elev = fields.get("total_ascent")
        if elev is not None and float(elev) > 0:
            result["elevationM"] = round(float(elev), 1)

        # HR
        avg_hr = fields.get("avg_heart_rate")
        if avg_hr is not None:
            result["avgHr"] = int(avg_hr)
        max_hr = fields.get("max_heart_rate")
        if max_hr is not None:
            result["maxHr"] = int(max_hr)

        # Calories
        cal = fields.get("total_calories")
        if cal is not None:
            result["calories"] = int(cal)

        # Speed
        avg_spd = fields.get("enhanced_avg_speed") or fields.get("avg_speed")
        if avg_spd is not None and float(avg_spd) > 0:
            result["avgSpeedMs"] = round(float(avg_spd), 3)
        max_spd = fields.get("enhanced_max_speed") or fields.get("max_speed")
        if max_spd is not None and float(max_spd) > 0:
            result["maxSpeedMs"] = round(float(max_spd), 3)

        break  # only first session

    return result if result["durationSec"] > 0 else None

def sport_to_name(sport: str, sub_sport: str | None, fit_file_id: str) -> str:
    """Generate a human-readable default name for activities with no meaningful name."""
    labels = {
        "running": "Run",
        "cycling": "Ride",
        "walking": "Walk",
        "swimming": "Swim",
        "hiking": "Hike",
        "strength_training": "Strength",
        "cardio_training": "Cardio",
        "yoga": "Yoga",
        "generic": "Activity",
    }
    return labels.get(sport, sport.replace("_", " ").title())

# ── Main import loop ───────────────────────────────────────────────────────────
fit_files = sorted(ACTIVITIES.rglob("*.fit"))
total     = len(fit_files)
imported  = 0
skipped   = 0
errors    = 0

print(f"Found {total} .fit files in garmin_activities/")
print("Importing activities...\n")

for i, fit_path in enumerate(fit_files, 1):
    if i % 100 == 0 or i == total:
        print(f"  [{i}/{total}] imported={imported} skipped={skipped} errors={errors}")

    # Extract fitFileId from filename: "119087856800.fit" → "119087856800"
    fit_file_id = fit_path.stem  # already stripped of "jerome.vanderpluym@gmail.com_" prefix

    # Skip if already imported
    cur.execute("SELECT 1 FROM GarminActivity WHERE fitFileId = ?", (fit_file_id,))
    if cur.fetchone():
        skipped += 1
        continue

    try:
        data = parse_fit(fit_path)
        if data is None:
            skipped += 1
            continue

        # Derive date string from start time
        if data["startTime"]:
            if isinstance(data["startTime"], datetime.datetime):
                date_str = data["startTime"].strftime("%Y-%m-%d")
            else:
                date_str = str(data["startTime"])[:10]
        else:
            # Fall back to year folder name
            date_str = fit_path.parent.name + "-01-01"

        name = sport_to_name(data["sport"], data["subSport"], fit_file_id)
        record_id = cuid_like(fit_file_id)

        cur.execute("""
            INSERT OR IGNORE INTO GarminActivity
                (id, fitFileId, date, name, sport, subSport,
                 durationSec, distanceM, elevationM,
                 avgHr, maxHr, calories, avgSpeedMs, maxSpeedMs)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            record_id, fit_file_id, date_str, name, data["sport"], data["subSport"],
            data["durationSec"], data["distanceM"], data["elevationM"],
            data["avgHr"], data["maxHr"], data["calories"],
            data["avgSpeedMs"], data["maxSpeedMs"],
        ))
        imported += 1

    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"  ERROR parsing {fit_path.name}: {e}")

conn.commit()
conn.close()

print(f"\n✅ Done!")
print(f"   Imported : {imported}")
print(f"   Skipped  : {skipped}  (already in DB or non-activity files)")
print(f"   Errors   : {errors}")
print(f"\nNext steps:")
print(f"  1. npx prisma generate   ← regenerate Prisma client")
print(f"  2. npm run dev           ← restart the app")
print(f"  3. Open http://localhost:3000/garmin")
