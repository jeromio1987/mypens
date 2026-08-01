-- Journal voice attachments (schema.prisma already declared; live DB lacked columns — Audit 7 C2)
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "voicePath" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "voiceDurationSec" INTEGER;
