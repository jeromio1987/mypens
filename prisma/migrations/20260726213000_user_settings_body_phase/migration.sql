-- Body phase on UserSettings (replaces data/body_phase.json file store)

ALTER TABLE "UserSettings" ADD COLUMN "bodyPhase" TEXT NOT NULL DEFAULT 'maintain';
ALTER TABLE "UserSettings" ADD COLUMN "bodyPhaseStartedAt" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "bodyPhaseKgPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 0.4;
ALTER TABLE "UserSettings" ADD COLUMN "bodyPhaseExpectedEndAt" TEXT;
