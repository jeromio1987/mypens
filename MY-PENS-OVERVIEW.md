# MY PENS — Project Overview

**Personal health tracking platform · Next.js web app + Expo companion app · Supabase/PostgreSQL · Hosted on Vercel**

## What MY PENS Is

MY PENS is a personal health ledger for people who want signal, not wellness theatre. It tracks weight, food, sleep, training, measurements, mood, recovery, and activity patterns with audit-style feedback and minimal hand-handling.

## Platform

MY PENS is a Next.js web app hosted on Vercel, with data stored in Supabase/PostgreSQL in the EU West region. It is installable as a PWA and shares its backend with the Expo / React Native companion app.

## Weight

The Weight module logs scale weight, Tanita body composition, and context that can distort the number. Its water-retention engine models creatine, alcohol, glycogen, sodium, hard training, illness, flights, and restaurant meals so the scale gets cross-examined before it gets believed.

## Food

The Food module tracks meals, calories, protein, carbs, fat, fibre, notes, and daily macro targets. It is built for practical logging, not nutritional theatre with a halo filter.

## Sleep

The Sleep module records bedtime, wake time, duration, quality, HRV, and notes. It supports trend review, sleep debt tracking, and feeds the wider audit layer where poor sleep stops hiding behind optimism.

## Training

The Training module logs exercises, sets, reps, weight, RPE, notes, and calculated volume. It supports weekly volume trends, per-exercise progression history, and accepts imported activity data from connected services.

## Body Measurements

The Measurements module tracks waist, chest, hips, arms, thighs, neck, notes, and progress photos. It gives body-composition context when weight alone is being dramatic.

## Journal / Mood

The Journal module captures daily mood, notes, and personal observations. It gives the platform a human signal layer, because not every useful metric comes from a sensor strapped to your wrist.

## Events, Goals, and Streaks

Event and trip tagging mark periods such as travel, illness, holidays, diet breaks, competitions, and other confounders. Goals and streaks track consistency and progress without pretending every day is a motivational poster.

## Anchor

Anchor is a private personal tracking module. It is not described in public documentation.

## Verdict

Verdict is the rule-based audit system across the P/E/N/S pillars. It turns recent data into ledger-style scoring and labels such as The Sleep Debt and The Nutrition Tax. An AI-powered weekly summary is generated via Claude and displayed at the top of the Verdict page.

## Clubroom

Clubroom is the gamification layer with medals, weekly wrap, report cards, and bronze/silver/gold/platinum tiers. It rewards consistency without turning the app into a circus leaderboard.

## Dopamine Router

The Dopamine router maps energy and available time to activity suggestions. It is rule-based and designed to route impulses into something less expensive than bad decisions.

## Integrations and Import

Built integrations include Garmin OAuth and webhook, Strava OAuth and webhook, Apple HealthKit, Android Health Connect, CSV import/export, and Tanita CSV import. Sync is user-initiated and focused on bringing data into the MY PENS ledger.

## Mobile App

The Expo / React Native companion app covers Weight, Food, Sleep, Training, Measurements, and Journal. It uses the same Supabase/PostgreSQL backend, with retention models running client-side.

## Not Built Yet

AI-powered Verdict pillar breakdown (summary is live, per-pillar AI is not), workout programme builder (in progress), weekly PDF reports, and multi-user or social features. The app remains a single-user app with no multi-user accounts in v1.
