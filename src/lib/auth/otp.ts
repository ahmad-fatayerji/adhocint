import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
    getRequiredEnv,
    hmacSha256Hex,
    randomToken,
    timingSafeEqualHex,
} from "@/lib/auth/crypto";
import crypto from "crypto";

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

export function generateOtpCode(): string {
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, "0");
}

async function getClientIp() {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim();
    return h.get("x-real-ip") || undefined;
}

export async function issueOtp(opts: {
    userId: string;
    purpose: string;
    ttlMinutes?: number;
    resendCooldownSeconds?: number;
}) {
    const ttlMinutes = opts.ttlMinutes ?? 10;
    const resendCooldownSeconds = opts.resendCooldownSeconds ?? 60;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    const h = await headers();
    const userAgent = h.get("user-agent") || undefined;
    const requestIp = await getClientIp();

    // Invalidate previous active OTPs for this user+purpose
    await prisma.emailOtp.updateMany({
        where: {
            userId: opts.userId,
            purpose: opts.purpose,
            consumedAt: null,
            expiresAt: { gt: now },
        },
        data: { consumedAt: now },
    });

    const otpRowId = randomToken(16);

    const existingRecent = await prisma.emailOtp.findFirst({
        where: { userId: opts.userId, purpose: opts.purpose },
        orderBy: { createdAt: "desc" },
    });

    if (
        existingRecent?.lastSentAt &&
        now.getTime() - existingRecent.lastSentAt.getTime() <
        resendCooldownSeconds * 1000
    ) {
        return { sent: false as const, reason: "cooldown" as const };
    }

    const code = generateOtpCode();
    const pepper = getRequiredEnv("OTP_PEPPER");
    const otpHash = hmacSha256Hex(
        pepper,
        `${code}:${opts.userId}:${opts.purpose}:${otpRowId}`
    );

    await prisma.emailOtp.create({
        data: {
            id: otpRowId,
            userId: opts.userId,
            purpose: opts.purpose,
            otpHash,
            expiresAt,
            maxAttempts: 5,
            attemptCount: 0,
            sendCount: 1,
            lastSentAt: now,
            requestIp,
            userAgent,
        },
    });

    return { sent: true as const, code, otpId: otpRowId, expiresAt };
}

export async function verifyOtp(opts: {
    userId: string;
    purpose: string;
    code: string;
}) {
    const now = new Date();
    const otp = await prisma.emailOtp.findFirst({
        where: {
            userId: opts.userId,
            purpose: opts.purpose,
            consumedAt: null,
            expiresAt: { gt: now },
            attemptCount: { lt: 5 },
        },
        orderBy: { createdAt: "desc" },
    });

    if (!otp) return { ok: false as const };

    const pepper = getRequiredEnv("OTP_PEPPER");
    const candidateHash = hmacSha256Hex(
        pepper,
        `${opts.code}:${opts.userId}:${opts.purpose}:${otp.id}`
    );

    const matches = timingSafeEqualHex(candidateHash, otp.otpHash);

    if (!matches) {
        await prisma.emailOtp.update({
            where: { id: otp.id },
            data: { attemptCount: { increment: 1 } },
        });
        return { ok: false as const };
    }

    // Consume atomically
    const consumed = await prisma.emailOtp.updateMany({
        where: {
            id: otp.id,
            consumedAt: null,
            expiresAt: { gt: now },
            attemptCount: { lt: otp.maxAttempts },
        },
        data: { consumedAt: now },
    });

    if (consumed.count !== 1) return { ok: false as const };

    return { ok: true as const };
}
