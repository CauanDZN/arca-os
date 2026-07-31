import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;
  
  // Detect if DATABASE_URL is a cloud/pooled Prisma Postgres service URL (starts with prisma://)
  const isAccelerate = dbUrl?.startsWith("prisma://") || dbUrl?.startsWith("prisma+postgres://");

  if (isAccelerate) {
    return new PrismaClient({
      accelerateUrl: dbUrl,
    } as any).$extends(withAccelerate());
  } else {
    // Standard Node.js adapter for direct connections (Docker postgres, SQLite, etc.)
    const adapter = new PrismaPg({ connectionString: dbUrl });
    return new PrismaClient({ adapter });
  }
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as unknown as PrismaClient;


if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

