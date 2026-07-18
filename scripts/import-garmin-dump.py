#!/usr/bin/env python3
"""
import-garmin-dump.py — Import a dropped Garmin export folder into MY PENS (Postgres).

Unlike the old import-garmin.py (SQLite / prisma/dev.db), this writes to the
DATABASE_URL Postgres (Supabase) so weekly feedback can see the data.

Usage (from repo root, with .env loaded or DATABASE_URL set):
    python scripts/import-garmin-dump.py "C:\\path\\to\\ba80da99-...._1"
    python scripts/import-garmin-dump.py "./ba80da99-886a-4f1b-989e-e41afa51d239_1"

What it does:
  1. Inventories the folder (.fit, sleep/weight-looking JSON/CSV)
  2. Imports activity .fit files → GarminActivity
  3. Best-effort: weight / sleep JSON from Garmin Connect exports → WeightEntry / SleepEntry
  4. Prints a clear summary

Safe to re-run (skips duplicates).
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── deps ──────────────────────────────────────────────────────────────────────
try:
    from fitparse import FitFile
except ImportError:
    import subprocess

    subprocess.run(
        [sys.executable, "-m", "pip", "install", "fitparse", "psycopg[binary]", "-q"],
        check=True,
    )
    from fitparse import FitFile

try:
    import psycopg
except ImportError:
    import subprocess

    subprocess.run(
        [sys.executable, "-m", "pip", "install", "psycopg[binary]", "-q"],
        check=True,
    )
    import psycopg


ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        os.environ.setdefault(key, val)


load_dotenv(ROOT / ".env")


def resolve_database_url() -> str:
    """Prefer DIRECT_URL (port 5432). Strip pgbouncer query params psycopg rejects."""
    direct = (os.environ.get("DIRECT_URL") or "").strip()
    url = direct or (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
        return ""
    # psycopg: invalid URI query parameter: "pgbouncer"
    if "pgbouncer=" in url or "pgbouncer" in url:
        from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

        parsed = urlparse(url)
        q = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() != "pgbouncer"]
        url = urlunparse(parsed._replace(query=urlencode(q)))
        print("NOTE: stripped pgbouncer= from DB URL for psycopg.")
    return url


DATABASE_URL = resolve_database_url()
if not DATABASE_URL:
    print("ERROR: DATABASE_URL (or DIRECT_URL) not set. Put it in .env.")
    sys.exit(1)


def cuid_like(fit_file_id: str) -> str:
    h = hashlib.sha256(fit_file_id.encode()).hexdigest()
    return f"garmin_{h[:20]}"


def parse_fit(fit_path: Path):
    try:
        data = fit_path.read_bytes()
        ff = FitFile(io.BytesIO(data))
    except Exception as e:
        return None, f"read/parse: {e}"

    file_type = None
    for msg in ff.get_messages("file_id"):
        for field in msg.fields:
            if field.name == "type":
                file_type = str(field.value)
        break
    if file_type != "activity":
        return None, "not_activity"

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
        sport = fields.get("sport")
        if sport:
            result["sport"] = str(sport).lower()
        sub = fields.get("sub_sport")
        if sub and str(sub).lower() not in ("generic", "none"):
            result["subSport"] = str(sub).lower()
        elapsed = fields.get("total_elapsed_time")
        if elapsed is not None:
            result["durationSec"] = float(elapsed)
        start = fields.get("start_time")
        if start:
            result["startTime"] = start
        dist = fields.get("total_distance")
        if dist is not None and float(dist) > 0:
            result["distanceM"] = round(float(dist), 1)
        elev = fields.get("total_ascent")
        if elev is not None and float(elev) > 0:
            result["elevationM"] = round(float(elev), 1)
        avg_hr = fields.get("avg_heart_rate")
        if avg_hr is not None:
            result["avgHr"] = int(avg_hr)
        max_hr = fields.get("max_heart_rate")
        if max_hr is not None:
            result["maxHr"] = int(max_hr)
        cal = fields.get("total_calories")
        if cal is not None:
            result["calories"] = int(cal)
        avg_spd = fields.get("enhanced_avg_speed") or fields.get("avg_speed")
        if avg_spd is not None and float(avg_spd) > 0:
            result["avgSpeedMs"] = round(float(avg_spd), 3)
        max_spd = fields.get("enhanced_max_speed") or fields.get("max_speed")
        if max_spd is not None and float(max_spd) > 0:
            result["maxSpeedMs"] = round(float(max_spd), 3)
        break

    if result["durationSec"] <= 0:
        return None, "no_duration"
    return result, None


def sport_to_name(sport: str) -> str:
    labels = {
        "running": "Run",
        "cycling": "Ride",
        "walking": "Walk",
        "swimming": "Swim",
        "hiking": "Hike",
        "strength_training": "Strength",
        "cardio_training": "Cardio",
        "yoga": "Yoga",
    }
    return labels.get(sport, sport.replace("_", " ").title())


def to_date_str(start) -> str | None:
    if start is None:
        return None
    if isinstance(start, datetime):
        return start.date().isoformat()
    s = str(start)
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else None


def inventory(dump: Path) -> dict:
    fits = list(dump.rglob("*.fit")) + list(dump.rglob("*.FIT"))
    jsons = list(dump.rglob("*.json")) + list(dump.rglob("*.JSON"))
    csvs = list(dump.rglob("*.csv")) + list(dump.rglob("*.CSV"))
    weightish = [
        p
        for p in jsons + csvs
        if re.search(
            r"weight|body.?comp|wellness|scale|biometric|user_metrics|bodycomp",
            p.name + " " + str(p),
            re.I,
        )
    ]
    sleepish = [
        p
        for p in jsons + csvs
        if re.search(r"sleep", p.name, re.I) or re.search(r"[\\/]sleep[\\/]", str(p), re.I)
    ]
    return {
        "fit": fits,
        "json": jsons,
        "csv": csvs,
        "weightish": weightish,
        "sleepish": sleepish,
    }


def walk_dicts(node, out: list):
    """Collect every dict in a nested JSON tree."""
    if isinstance(node, dict):
        out.append(node)
        for v in node.values():
            walk_dicts(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_dicts(v, out)


def probe_json(paths: list[Path], label: str, limit: int = 3) -> None:
    """Print structure hints so we can see Garmin export shapes."""
    print(f"[garmin-dump] probe {label} (first {min(limit, len(paths))} files):")
    for path in paths[:limit]:
        try:
            raw = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception as e:
            print(f"  {path.name}: unreadable ({e})")
            continue
        dicts: list = []
        walk_dicts(raw, dicts)
        keys = sorted({k for d in dicts[:40] for k in d.keys()})[:40]
        print(f"  {path.name}: type={type(raw).__name__} nested_dicts={len(dicts)} keys≈{keys}")


DATE_KEYS = ("calendarDate", "date", "calendar_date", "day", "startDate")
SLEEP_SEC_KEYS = (
    "sleepingSeconds",
    "sleepTimeSeconds",
    "durationInSeconds",
    "totalSleepTimeInSeconds",
    "sleepDurationInSeconds",
    "duration",
)
WEIGHT_KEYS = (
    "weightInGrams",
    "weight",
    "weightKg",
    "weightInKilograms",
    "bodyWeight",
)


def extract_date(d: dict) -> str | None:
    for k in DATE_KEYS:
        v = d.get(k)
        if not v:
            continue
        s = str(v)
        m = re.search(r"(\d{4}-\d{2}-\d{2})", s)
        if m:
            return m.group(1)
        # Garmin sometimes uses ms timestamps
        try:
            n = float(v)
            if n > 1e12:
                return datetime.fromtimestamp(n / 1000, tz=timezone.utc).date().isoformat()
            if n > 1e9:
                return datetime.fromtimestamp(n, tz=timezone.utc).date().isoformat()
        except Exception:
            pass
    # startTimeInSeconds style
    for k in ("startTimeInSeconds", "sleepStartTimestampGMT", "startTimeGMT"):
        v = d.get(k)
        if v is None:
            continue
        try:
            n = float(v)
            if n > 1e12:
                n /= 1000
            return datetime.fromtimestamp(n, tz=timezone.utc).date().isoformat()
        except Exception:
            continue
    return None


def extract_sleep_seconds(d: dict) -> float | None:
    for k in SLEEP_SEC_KEYS:
        if k in d and d[k] is not None:
            try:
                v = float(d[k])
                # if value looks like hours already
                if k == "duration" and v < 24:
                    return v * 3600
                return v
            except Exception:
                continue

    # Garmin Connect export shape (seen in *_sleepData.json):
    #   deepSleepSeconds + lightSleepSeconds (+ remSleepSeconds)
    #   optionally derive from sleepStartTimestampGMT → sleepEndTimestampGMT
    parts = 0.0
    found_stage = False
    for k in ("deepSleepSeconds", "lightSleepSeconds", "remSleepSeconds"):
        if d.get(k) is not None:
            try:
                parts += float(d[k])
                found_stage = True
            except Exception:
                pass
    if found_stage and parts > 0:
        return parts

    start = d.get("sleepStartTimestampGMT")
    end = d.get("sleepEndTimestampGMT")
    if start is not None and end is not None:
        try:
            s, e = float(start), float(end)
            # ms vs seconds
            if s > 1e12:
                s, e = s / 1000.0, e / 1000.0
            delta = e - s
            if 3600 <= delta <= 16 * 3600:
                return delta
        except Exception:
            pass

    # nested dailySleepDTO
    dto = d.get("dailySleepDTO")
    if isinstance(dto, dict):
        return extract_sleep_seconds(dto)
    return None


def extract_weight_kg(d: dict) -> float | None:
    for k in WEIGHT_KEYS:
        if k not in d or d[k] is None:
            continue
        try:
            v = float(d[k])
        except Exception:
            continue
        if k in ("weightKg", "weightInKilograms") or (k == "weight" and v < 250):
            return v
        # grams
        if v > 200:
            return v / 1000.0
        if 30 <= v <= 250:
            return v
    return None


def import_fits(conn, fits: list[Path]) -> tuple[int, int, int]:
    imported = skipped = errors = 0
    with conn.cursor() as cur:
        for i, fit_path in enumerate(fits, 1):
            fit_file_id = fit_path.stem
            cur.execute('SELECT 1 FROM "GarminActivity" WHERE "fitFileId" = %s', (fit_file_id,))
            if cur.fetchone():
                skipped += 1
                continue
            parsed, err = parse_fit(fit_path)
            if not parsed:
                if err == "not_activity":
                    skipped += 1
                else:
                    errors += 1
                    if errors <= 5:
                        print(f"  skip {fit_path.name}: {err}")
                continue
            date = to_date_str(parsed["startTime"])
            if not date:
                # fallback: try parent folder year/month patterns or file mtime
                date = datetime.fromtimestamp(fit_path.stat().st_mtime).date().isoformat()
            name = sport_to_name(parsed["sport"])
            row_id = cuid_like(fit_file_id)
            try:
                cur.execute(
                    """
                    INSERT INTO "GarminActivity"
                    ("id","createdAt","fitFileId","date","name","sport","subSport",
                     "durationSec","distanceM","elevationM","avgHr","maxHr","calories",
                     "avgSpeedMs","maxSpeedMs")
                    VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT ("fitFileId") DO NOTHING
                    """,
                    (
                        row_id,
                        fit_file_id,
                        date,
                        name,
                        parsed["sport"],
                        parsed["subSport"],
                        parsed["durationSec"],
                        parsed["distanceM"],
                        parsed["elevationM"],
                        parsed["avgHr"],
                        parsed["maxHr"],
                        parsed["calories"],
                        parsed["avgSpeedMs"],
                        parsed["maxSpeedMs"],
                    ),
                )
                if cur.rowcount:
                    imported += 1
                else:
                    skipped += 1
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  DB error {fit_path.name}: {e}")
            if i % 50 == 0:
                conn.commit()
                print(f"  … {i}/{len(fits)} FIT files processed")
        conn.commit()
    return imported, skipped, errors


def try_import_weight_json(conn, paths: list[Path]) -> tuple[int, int]:
    """Walk nested Garmin JSON and upsert any weight-looking dicts."""
    from secrets import token_hex

    ingested = skipped = 0
    seen_dates: set[str] = set()
    with conn.cursor() as cur:
        for path in paths:
            try:
                raw = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                continue
            dicts: list = []
            walk_dicts(raw, dicts)
            for bc in dicts:
                scale = extract_weight_kg(bc)
                date = extract_date(bc)
                if not scale or not date or date in seen_dates:
                    continue
                if scale < 30 or scale > 250:
                    continue
                seen_dates.add(date)
                cur.execute('SELECT id, source FROM "WeightEntry" WHERE date = %s LIMIT 1', (date,))
                existing = cur.fetchone()
                if existing and existing[1] == "manual":
                    skipped += 1
                    continue
                bf = bc.get("bodyFatPercentage") or bc.get("bodyFat")
                muscle_g = bc.get("muscleMassInGrams")
                bone_g = bc.get("boneWeightInGrams") or bc.get("boneMassInGrams")
                muscle = float(muscle_g) / 1000 if muscle_g else None
                bone = float(bone_g) / 1000 if bone_g else None
                if existing:
                    cur.execute(
                        """
                        UPDATE "WeightEntry"
                        SET "scaleKg"=%s, "trueWeightKg"=%s, "bodyFatPct"=%s,
                            "muscleMassKg"=%s, "boneMassKg"=%s, source='garmin'
                        WHERE id=%s
                        """,
                        (scale, scale, bf, muscle, bone, existing[0]),
                    )
                else:
                    wid = f"c{token_hex(12)}"
                    cur.execute(
                        """
                        INSERT INTO "WeightEntry"
                        (id, "createdAt", date, "scaleKg", "trueWeightKg", "bodyFatPct",
                         "muscleMassKg", "boneMassKg", source, "tanitaReliable",
                         "creatineDoseG","creatineDaysOn","creatinePostLoad",
                         "alcoholUnits","hoursSinceAlcohol","carbsG","hardTraining",
                         "morningReading","highSodium","restaurantMeal","flightDay","illnessDay",
                         "creatineRetentionKg","alcoholRetentionKg","glycogenRetentionKg")
                        VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, 'garmin', true,
                                0,0,false,0,48,0,false,true,false,false,false,false,0,0,0)
                        """,
                        (wid, date, scale, scale, bf, muscle, bone),
                    )
                ingested += 1
        conn.commit()
    return ingested, skipped


def try_import_sleep_json(conn, paths: list[Path]) -> tuple[int, int]:
    """Walk nested Garmin sleep JSON (dailySleepDTO, sleepTimeSeconds, …)."""
    from secrets import token_hex

    ingested = skipped = 0
    seen_dates: set[str] = set()
    with conn.cursor() as cur:
        for path in paths:
            try:
                raw = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                continue
            dicts: list = []
            walk_dicts(raw, dicts)
            for d in dicts:
                # Prefer the DTO if present
                src = d.get("dailySleepDTO") if isinstance(d.get("dailySleepDTO"), dict) else d
                date = extract_date(src) or extract_date(d)
                secs = extract_sleep_seconds(src) or extract_sleep_seconds(d)
                if not date or not secs:
                    continue
                if date in seen_dates:
                    continue
                hours = round(float(secs) / 3600.0, 1)
                if hours < 1 or hours > 16:
                    continue
                seen_dates.add(date)
                cur.execute('SELECT 1 FROM "SleepEntry" WHERE date = %s', (date,))
                if cur.fetchone():
                    skipped += 1
                    continue
                sid = f"c{token_hex(12)}"
                total = 7 * 60 - int(hours * 60)
                total = (total % 1440 + 1440) % 1440
                bed = f"{total // 60:02d}:{total % 60:02d}"
                hrv = src.get("avgSleepingHRV") or src.get("avgHrv") or d.get("avgSleepingHRV")
                quality = 3
                if hrv is not None:
                    try:
                        hv = float(hrv)
                        quality = 1 if hv < 30 else 2 if hv < 45 else 3 if hv < 60 else 4 if hv < 75 else 5
                    except Exception:
                        hv = None
                else:
                    hv = None
                try:
                    cur.execute(
                        """
                        INSERT INTO "SleepEntry"
                        (id, "createdAt", date, bedtime, "wakeTime", hours, quality, hrv)
                        VALUES (%s, NOW(), %s, %s, '07:00', %s, %s, %s)
                        ON CONFLICT (date) DO NOTHING
                        """,
                        (sid, date, bed, hours, quality, hv),
                    )
                    if cur.rowcount:
                        ingested += 1
                    else:
                        skipped += 1
                except Exception as e:
                    print(f"  sleep insert skip: {e}")
                    skipped += 1
        conn.commit()
    return ingested, skipped


def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python scripts/import-garmin-dump.py "PATH\\TO\\DUMP_FOLDER"')
        sys.exit(1)

    dump = Path(sys.argv[1]).expanduser().resolve()
    if not dump.exists():
        print(f"ERROR: folder not found: {dump}")
        sys.exit(1)

    print(f"[garmin-dump] scanning {dump}")
    inv = inventory(dump)
    print(f"  .fit files:     {len(inv['fit'])}")
    print(f"  JSON files:     {len(inv['json'])}")
    print(f"  CSV files:      {len(inv['csv'])}")
    print(f"  weight-looking: {len(inv['weightish'])}")
    print(f"  sleep-looking:  {len(inv['sleepish'])}")

    if not inv["fit"] and not inv["weightish"] and not inv["sleepish"]:
        print("Nothing recognisable found. Open the folder and tell me the file names inside.")
        # print top-level listing to help
        try:
            for p in sorted(dump.iterdir())[:30]:
                print(f"  - {p.name}{'/' if p.is_dir() else ''}")
        except Exception:
            pass
        sys.exit(2)

    print("[garmin-dump] connecting to DATABASE_URL …")
    with psycopg.connect(DATABASE_URL) as conn:
        if inv["fit"]:
            print(f"[garmin-dump] importing {len(inv['fit'])} FIT activities …")
            a, s, e = import_fits(conn, inv["fit"])
            print(f"  activities: {a} imported, {s} skipped, {e} errors")
        else:
            print("[garmin-dump] no .fit activities found")

        # Sleep first — this dump has many sleep JSON files in a non-API shape.
        sleep_paths = inv["sleepish"] or []
        if sleep_paths:
            probe_json(sleep_paths, "sleep")
            print(f"[garmin-dump] importing sleep from {len(sleep_paths)} files …")
            sl, ss = try_import_sleep_json(conn, sleep_paths)
            print(f"  sleep: {sl} ingested, {ss} skipped")
            if sl == 0 and ss == 0:
                print("  (no recognisable sleep fields — probe keys above matter)")
        else:
            print("[garmin-dump] no sleep-looking JSON — use /garmin Sync sleep if OAuth is connected")

        weight_paths = inv["weightish"] or []
        # If nothing named weight, scan a sample of all JSON for weight keys (slow but useful).
        if not weight_paths and inv["json"]:
            print("[garmin-dump] no weight-named files — scanning all JSON for weight fields …")
            weight_paths = inv["json"]
        if weight_paths:
            if len(weight_paths) <= 30:
                probe_json(weight_paths, "weight")
            print(f"[garmin-dump] importing weight from {len(weight_paths)} files …")
            w, ws = try_import_weight_json(conn, weight_paths)
            print(f"  weight: {w} ingested, {ws} skipped")
        else:
            print("[garmin-dump] no JSON for weight — use /garmin Sync body weight if OAuth is connected")

    print("[garmin-dump] done.")
    print("Next: npm run feedback:weekly   then open /weekly-feedback")


if __name__ == "__main__":
    main()
