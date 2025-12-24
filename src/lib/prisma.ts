import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required to use Prisma");
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

function getClient() {
    if (global.__prisma) return global.__prisma;
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
        global.__prisma = client;
    }
    return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getClient() as any;
        const value = client[prop];
        return typeof value === "function" ? value.bind(client) : value;
    },
});
