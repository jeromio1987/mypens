-- Adaptive Sports Planner goals + accepted weeks
CREATE TABLE IF NOT EXISTS "PlannerGoal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetNum" DOUBLE PRECISION,
    "targetText" TEXT,
    "raceDate" TEXT,
    "longDay" TEXT NOT NULL DEFAULT 'saturday',
    "sportsJson" TEXT NOT NULL DEFAULT '["running","gym"]',
    "notes" TEXT,
    CONSTRAINT "PlannerGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlannerWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekOf" TEXT NOT NULL,
    "goalId" TEXT,
    "planJson" TEXT NOT NULL DEFAULT '{}',
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlannerWeek_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlannerWeek_weekOf_key" ON "PlannerWeek"("weekOf");
CREATE INDEX IF NOT EXISTS "PlannerWeek_goalId_idx" ON "PlannerWeek"("goalId");
