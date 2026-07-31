import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Generic node-postgres adapter — works with any standard Postgres connection
// string (Neon, Supabase, Vercel Postgres, Railway...), not tied to one
// provider's proprietary driver. On serverless (Vercel), DATABASE_URL should
// be the *pooled* connection string your provider gives you (e.g. Neon's
// "-pooler" host) — a raw unpooled connection exhausts Postgres's connection
// limit under concurrent function invocations.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
