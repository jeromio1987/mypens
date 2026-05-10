-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeDay" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgrammeDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeExercise" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgrammeExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgrammeDay_programmeId_idx" ON "ProgrammeDay"("programmeId");

-- CreateIndex
CREATE INDEX "ProgrammeExercise_dayId_idx" ON "ProgrammeExercise"("dayId");

-- AddForeignKey
ALTER TABLE "ProgrammeDay" ADD CONSTRAINT "ProgrammeDay_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeExercise" ADD CONSTRAINT "ProgrammeExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ProgrammeDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
