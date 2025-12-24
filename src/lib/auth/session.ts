import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/constants";
import { getRequiredEnv, hmacSha256Hex, randomToken } from "@/lib/auth/crypto";

const SESSION_TTL_DAYS = Number(process.env.ADMIN_SESSION_TTL_DAYS || "14");

async function getClientIp() {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim();
    return h.get("x-real-ip") || undefined;
}

export async function createAdminSession(userId: string) {
    const secret = getRequiredEnv("AUTH_SESSION_SECRET");
    const token = randomToken(32);
    const tokenHash = hmacSha256Hex(secret, token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86400_000);

    const h = await headers();
    const ip = await getClientIp();
    const userAgent = h.get("user-agent") || undefined;

    await prisma.adminSession.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
            ip,
            userAgent,
        },
    });

    const isProd = process.env.NODE_ENV === "production";
    const c = await cookies();
    c.set({
        name: ADMIN_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
    });
}

export async function getAdminSession() {
    const c = await cookies();
    const token = c.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return null;

    const secret = process.env.AUTH_SESSION_SECRET;
    if (!secret) return null;

    const tokenHash = hmacSha256Hex(secret, token);
    const now = new Date();

    const session = await prisma.adminSession.findUnique({
        where: { tokenHash },
        include: { user: true },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt <= now) return null;
    if (!session.user.isActive) return null;

    await prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
    });

    return session;
}

export async function revokeAdminSession() {
    const c = await cookies();
    const token = c.get(ADMIN_SESSION_COOKIE)?.value;
    c.set({
        name: ADMIN_SESSION_COOKIE,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
    });

    const secret = process.env.AUTH_SESSION_SECRET;
    if (!token || !secret) return;

    const tokenHash = hmacSha256Hex(secret, token);
    await prisma.adminSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
