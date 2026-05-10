-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "scaleKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "boneMassKg" DOUBLE PRECISION,
    "bodyWaterPct" DOUBLE PRECISION,
    "visceralFat" INTEGER,
    "creatineDoseG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creatineDaysOn" INTEGER NOT NULL DEFAULT 0,
    "creatinePostLoad" BOOLEAN NOT NULL DEFAULT false,
    "alcoholUnits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursSinceAlcohol" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hardTraining" BOOLEAN NOT NULL DEFAULT false,
    "morningReading" BOOLEAN NOT NULL DEFAULT true,
    "highSodium" BOOLEAN NOT NULL DEFAULT false,
    "restaurantMeal" BOOLEAN NOT NULL DEFAULT false,
    "flightDay" BOOLEAN NOT NULL DEFAULT false,
    "illnessDay" BOOLEAN NOT NULL DEFAULT false,
    "creatineRetentionKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alcoholRetentionKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "glycogenRetentionKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trueWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tanitaReliable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "meal" TEXT NOT NULL DEFAULT 'snack',
    "name" TEXT NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "FoodEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "bedtime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "quality" INTEGER NOT NULL,
    "hrv" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "SleepEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rpe" INTEGER,
    "notes" TEXT,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "externalRaw" TEXT,

    CONSTRAINT "TrainingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "athleteId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "scope" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "webhookId" INTEGER,
    "webhookVerifyToken" TEXT,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "garminUserId" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "scope" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "pingSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthkitConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "pairingToken" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastClientError" TEXT,
    "lastClientErrorAt" TIMESTAMP(3),
    "lastStaleNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthkitConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthConnectConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "pairingToken" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastClientError" TEXT,
    "lastClientErrorAt" TIMESTAMP(3),
    "lastStaleNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthConnectConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushedWorkout" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "notes" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "distanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "raw" TEXT NOT NULL,

    CONSTRAINT "PushedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkippedPushedWorkout" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "skippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT,
    "exercise" TEXT,
    "notes" TEXT,

    CONSTRAINT "SkippedPushedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fitFileId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "subSport" TEXT,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "elevationM" DOUBLE PRECISION,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "calories" INTEGER,
    "avgSpeedMs" DOUBLE PRECISION,
    "maxSpeedMs" DOUBLE PRECISION,

    CONSTRAINT "GarminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "waistCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "leftArmCm" DOUBLE PRECISION,
    "rightArmCm" DOUBLE PRECISION,
    "leftThighCm" DOUBLE PRECISION,
    "rightThighCm" DOUBLE PRECISION,
    "neckCm" DOUBLE PRECISION,
    "notes" TEXT,
    "photoPath" TEXT,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EventTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "startValue" DOUBLE PRECISION NOT NULL,
    "startDate" TEXT NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "alcoholDrinks" INTEGER NOT NULL DEFAULT 0,
    "cocaineUsed" BOOLEAN NOT NULL DEFAULT false,
    "escortUsed" BOOLEAN NOT NULL DEFAULT false,
    "mood" INTEGER,
    "energy" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "supplements" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,

    CONSTRAINT "RecoveryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CravingEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target" TEXT NOT NULL DEFAULT 'alcohol',
    "trigger" TEXT,
    "action" TEXT NOT NULL DEFAULT 'cold_shower',
    "outcome" TEXT NOT NULL DEFAULT 'resisted',
    "notes" TEXT,

    CONSTRAINT "CravingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoverySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "drinkCostEur" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "cocaineGramEur" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "escortNightEur" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "baselineDrinksPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "baselineCocaineGramsPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "baselineEscortsPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "resetStartDate" TEXT NOT NULL DEFAULT '2026-05-01',
    "phase1ResetDays" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "RecoverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryMilestone" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RecoveryMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SleepEntry_date_key" ON "SleepEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEntry_source_externalId_key" ON "TrainingEntry"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_userId_key" ON "StravaConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GarminConnection_userId_key" ON "GarminConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthkitConnection_userId_key" ON "HealthkitConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthkitConnection_pairingToken_key" ON "HealthkitConnection"("pairingToken");

-- CreateIndex
CREATE UNIQUE INDEX "HealthConnectConnection_userId_key" ON "HealthConnectConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthConnectConnection_pairingToken_key" ON "HealthConnectConnection"("pairingToken");

-- CreateIndex
CREATE UNIQUE INDEX "PushedWorkout_source_externalId_key" ON "PushedWorkout"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SkippedPushedWorkout_source_externalId_key" ON "SkippedPushedWorkout"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GarminActivity_fitFileId_key" ON "GarminActivity"("fitFileId");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMeasurement_date_key" ON "BodyMeasurement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DayEntry_date_key" ON "DayEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryEntry_date_key" ON "RecoveryEntry"("date");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
