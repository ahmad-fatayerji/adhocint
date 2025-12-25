import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
    // eslint-disable-next-line no-var
    var __pgPool: Pool | undefined;
}

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required to use Prisma");
    }

    // Reuse pool if it exists, otherwise create new one with limits
    if (!global.__pgPool) {
        global.__pgPool = new Pool({
            connectionString,
            max: 20, // Maximum 20 connections in pool (increase for more traffic)
            min: 2, // Keep at least 2 connections ready
            idleTimeoutMillis: 30000, // Close idle connections after 30s
            connectionTimeoutMillis: 10000, // Wait up to 10s for a connection
            allowExitOnIdle: false, // Keep pool alive
        });

        // Handle pool errors gracefully
        global.__pgPool.on("error", (err) => {
            console.error("Unexpected PostgreSQL pool error:", err);
        });
    }

    const adapter = new PrismaPg(global.__pgPool);
    return new PrismaClient({ adapter });
}

function getClient() {
    if (global.__prisma) return global.__prisma;
    const client = createPrismaClient();
    // Always cache the client (production and development)
    global.__prisma = client;
    return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getClient() as any;
        const value = client[prop];
        return typeof value === "function" ? value.bind(client) : value;
    },
});
