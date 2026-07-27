-- WP 0.2: SleepEntry source/externalId + nullable quality (no invented 3★)

ALTER TABLE "SleepEntry" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "SleepEntry" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- quality may be absent when HRV was never measured
ALTER TABLE "SleepEntry" ALTER COLUMN "quality" DROP NOT NULL;

-- Backfill source from notes heuristics
UPDATE "SleepEntry"
SET "source" = 'healthconnect'
WHERE "notes" ILIKE '%Health Connect%';

UPDATE "SleepEntry"
SET "source" = 'garmin'
WHERE "source" = 'manual'
  AND ("notes" ILIKE '%garmin%' OR "notes" ILIKE '%Garmin%');

-- Clear invented quality=3 (and any quality) when there was no HRV
UPDATE "SleepEntry"
SET "quality" = NULL
WHERE "hrv" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SleepEntry_externalId_key" ON "SleepEntry"("externalId");
CREATE INDEX IF NOT EXISTS "SleepEntry_source_idx" ON "SleepEntry"("source");
