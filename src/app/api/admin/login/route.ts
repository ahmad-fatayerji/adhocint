import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeEmail, issueOtp } from "@/lib/auth/otp";
import { OTP_PURPOSE_ADMIN_LOGIN } from "@/lib/auth/constants";
import { sendMail } from "@/lib/mail";
import { ensureSuperAdminForEmail } from "@/lib/auth/superAdmin";
import { verify } from "@node-rs/argon2";

function getClientIp(req: Request) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim();
    return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
    if (!process.env.OTP_PEPPER) {
        return NextResponse.json(
            {
                ok: false,
                error: "Server is missing OTP_PEPPER. Add it to .env.local and rebuild.",
            },
            { status: 500 }
        );
    }

    if (
        !process.env.EMAIL_HOST ||
        !process.env.EMAIL_PORT ||
        !process.env.EMAIL_USER ||
        !process.env.EMAIL_PASS
    ) {
        return NextResponse.json(
            {
                ok: false,
                error: "Email is not configured (missing EMAIL_*). Add it to .env.local and rebuild.",
            },
            { status: 500 }
        );
    }

    const ip = getClientIp(req);

    // Rate limits (secure defaults)
    const ipLimit = await rateLimit(`ip:${ip}:admin_login`, {
        windowMs: 15 * 60_000,
        limit: 5,
        blockMs: 15 * 60_000,
    });
    if (!ipLimit.allowed) {
        return NextResponse.json(
            { ok: false, error: "Too many attempts. Try again later." },
            { status: 429 }
        );
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { ok: false, error: "Invalid request." },
            { status: 400 }
        );
    }

    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const email = normalizeEmail(emailRaw);

    if (!email || !password) {
        return NextResponse.json(
            { ok: false, error: "Email and password are required." },
            { status: 400 }
        );
    }

    const superAdminResult = await ensureSuperAdminForEmail(email);
    if (!superAdminResult.ok) {
        return NextResponse.json(
            { ok: false, error: superAdminResult.error },
            { status: 500 }
        );
    }

    const emailLimit = await rateLimit(`email:${email}:admin_login`, {
        windowMs: 15 * 60_000,
        limit: 3,
        blockMs: 15 * 60_000,
    });
    if (!emailLimit.allowed) {
        return NextResponse.json(
            { ok: false, error: "Too many attempts. Try again later." },
            { status: 429 }
        );
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });

    // Generic error (do not reveal whether the email exists).
    if (!user || !user.isActive || !user.mfaEnabled) {
        await new Promise((r) => setTimeout(r, 150));
        return NextResponse.json(
            { ok: false, error: "Invalid email or password." },
            { status: 401 }
        );
    }

    const passwordOk = await verify(user.passwordHash, password);
    if (!passwordOk) {
        await new Promise((r) => setTimeout(r, 150));
        return NextResponse.json(
            { ok: false, error: "Invalid email or password." },
            { status: 401 }
        );
    }

    const issued = await issueOtp({
        userId: user.id,
        purpose: OTP_PURPOSE_ADMIN_LOGIN,
        ttlMinutes: 10,
        resendCooldownSeconds: 60,
    });

    // If we are in cooldown, a code was already sent recently.
    if (!issued.sent && issued.reason === "cooldown") {
        return NextResponse.json(
            {
                ok: true,
                message: "A verification code was already sent recently. Please check your email.",
            },
            { status: 200 }
        );
    }

    if (!issued.sent) {
        return NextResponse.json(
            { ok: false, error: "Unable to issue a verification code. Try again." },
            { status: 500 }
        );
    }

    const subject = "Your ADHOC Admin verification code";
    const text = `Your verification code is: ${issued.code}\n\nThis code expires in 10 minutes.`;

    try {
        await sendMail({ to: user.email, subject, text });
    } catch {
        // Invalidate this OTP if we failed to send it.
        try {
            await prisma.emailOtp.update({
                where: { id: issued.otpId },
                data: { consumedAt: new Date() },
            });
        } catch {
            // ignore
        }

        return NextResponse.json(
            { ok: false, error: "Failed to send verification code. Try again." },
            { status: 502 }
        );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}
