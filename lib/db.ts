import { PrismaClient } from '@prisma/client'

/**
 * Cursor/shell sometimes injects DATABASE_URL with literal quotes
 * (`"postgresql://..."`). Prisma then rejects the protocol. Strip before client init.
 * Prefer .env file value when process env is quote-wrapped garbage.
 */
function normalizeDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL
  if (!raw) return
  let u = raw.trim()
  while (
    (u.startsWith('"') && u.endsWith('"') && u.length >= 2) ||
    (u.startsWith("'") && u.endsWith("'") && u.length >= 2)
  ) {
    u = u.slice(1, -1).trim()
  }
  if (u !== raw) process.env.DATABASE_URL = u
}

normalizeDatabaseUrl()

const prismaClientSingleton = () => new PrismaClient()

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
export { prisma }

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
