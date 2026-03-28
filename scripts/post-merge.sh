#!/bin/bash
set -e

npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --accept-data-loss
