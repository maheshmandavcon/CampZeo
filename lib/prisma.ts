import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
    prisma: PrismaClient;
    pool: Pool;
};

// Create a connection pool
const pool = globalForPrisma.pool || new Pool({
    connectionString: process.env.DATABASE_URL
});

if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

// Create the Prisma adapter
const adapter = new PrismaPg(pool);

// Create the Prisma client with the adapter
export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
