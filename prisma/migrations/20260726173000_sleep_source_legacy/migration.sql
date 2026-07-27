-- WP 0.2 follow-up: unlabeled history must not be locked as "manual"
-- (otherwise Health Connect can never correct existing wake-dates).

UPDATE "SleepEntry"
SET "source" = 'healthconnect'
WHERE "notes" ILIKE '%Health Connect%';

UPDATE "SleepEntry"
SET "source" = 'garmin'
WHERE "source" = 'manual'
  AND ("notes" ILIKE '%garmin%' OR "notes" ILIKE '%Garmin%');

-- Pre-source rows with no notes: allow HC/Garmin updates (not user-protected)
UPDATE "SleepEntry"
SET "source" = 'legacy'
WHERE "source" = 'manual'
  AND ("notes" IS NULL OR btrim("notes") = '');
