-- CreateTable
CREATE TABLE "AiVerdictCache" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "summary" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiVerdictCache_pkey" PRIMARY KEY ("id")
);
