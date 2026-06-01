-- One-time Supabase / PostgreSQL (same DATABASE_URL as MY PENS Prisma).
-- Run in SQL editor or: psql "$DATABASE_URL" -f scripts/cross-app-schema.sql

CREATE SCHEMA IF NOT EXISTS cross_app;

CREATE TABLE IF NOT EXISTS cross_app.daily_snapshot (
  date          DATE PRIMARY KEY,
  sleep_score   DOUBLE PRECISION,
  hrv_readiness DOUBLE PRECISION,
  weight_kg     DOUBLE PRECISION,
  regime        TEXT,
  pnl_pct       DOUBLE PRECISION,
  mood          INTEGER,
  energy        INTEGER,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cross_app.impulses (
  id           SERIAL PRIMARY KEY,
  source       TEXT,
  ticker       TEXT,
  direction    TEXT,
  reason       TEXT,
  acted        BOOLEAN DEFAULT FALSE,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Prisma `DATABASE_URL` must be able to INSERT/UPDATE this table (direct or pooled
-- connection with schema create rights). Cockpit reads via Supabase anon — use RLS
-- or a read-only view as you prefer; not configured here.
