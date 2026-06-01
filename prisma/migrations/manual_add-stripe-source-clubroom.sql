-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- Applies: WeightEntry.source, UserSettings.stripeCustomerId, Club, ClubMember

-- 1. Add source column to WeightEntry
ALTER TABLE "WeightEntry" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

-- 2. Add stripeCustomerId to UserSettings
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- 3. Club table
CREATE TABLE IF NOT EXISTS "Club" (
  "id"         SERIAL PRIMARY KEY,
  "name"       TEXT NOT NULL UNIQUE,
  "inviteCode" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ClubMember table
CREATE TABLE IF NOT EXISTS "ClubMember" (
  "id"          SERIAL PRIMARY KEY,
  "clubId"      INTEGER NOT NULL REFERENCES "Club"("id"),
  "userId"      TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("clubId", "userId")
);
