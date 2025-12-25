import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
    allowed: boolean;
    blockedUntil?: Date | null;
};

export async function rateLimit(
    key: string,
    {
        windowMs,
        limit,
        blockMs,
    }: { windowMs: number; limit: number; blockMs: number }
): Promise<RateLimitResult> {
    const disable =
        process.env.DISABLE_RATE_LIMITS === "1" ||
        process.env.DISABLE_RATE_LIMITS === "true" ||
        process.env.NODE_ENV !== "production";

    if (disable) {
        return { allowed: true };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const existing = await prisma.loginRateLimit.findUnique({ where: { key } });

    if (!existing) {
        await prisma.loginRateLimit.create({
            data: {
                key,
                windowStart: now,
                count: 1,
                blockedUntil: null,
            },
        });
        return { allowed: true };
    }

    if (existing.blockedUntil && existing.blockedUntil > now) {
        return { allowed: false, blockedUntil: existing.blockedUntil };
    }

    if (existing.windowStart < windowStart) {
        await prisma.loginRateLimit.update({
            where: { key },
            data: { windowStart: now, count: 1, blockedUntil: null },
        });
        return { allowed: true };
    }

    const nextCount = existing.count + 1;
    if (nextCount > limit) {
        const blockedUntil = new Date(now.getTime() + blockMs);
        await prisma.loginRateLimit.update({
            where: { key },
            data: { count: nextCount, blockedUntil },
        });
        return { allowed: false, blockedUntil };
    }

    await prisma.loginRateLimit.update({
        where: { key },
        data: { count: nextCount },
    });

    return { allowed: true };
}
