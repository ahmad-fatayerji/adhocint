import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeEmail, verifyOtp } from "@/lib/auth/otp";
import { OTP_PURPOSE_ADMIN_LOGIN } from "@/lib/auth/constants";
import { createAdminSession } from "@/lib/auth/session";

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

    if (!process.env.AUTH_SESSION_SECRET) {
        return NextResponse.json(
            {
                ok: false,
                error: "Server is missing AUTH_SESSION_SECRET. Add it to .env.local and rebuild.",
            },
            { status: 500 }
        );
    }

    const ip = getClientIp(req);

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const otp = typeof body?.otp === "string" ? body.otp : "";
    const email = normalizeEmail(emailRaw);

    if (!email || !otp || otp.length !== 6) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const rl = await rateLimit(`ip_email:${ip}:${email}:admin_verify`, {
        windowMs: 15 * 60_000,
        limit: 10,
        blockMs: 15 * 60_000,
    });
    if (!rl.allowed) {
        return NextResponse.json(
            { ok: false, error: "Too many attempts. Try again later." },
            { status: 429 }
        );
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !user.isActive) {
        await new Promise((r) => setTimeout(r, 150));
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const ok = await verifyOtp({
        userId: user.id,
        purpose: OTP_PURPOSE_ADMIN_LOGIN,
        code: otp,
    });

    if (!ok.ok) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    await prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    await createAdminSession(user.id);

    return NextResponse.json({ ok: true }, { status: 200 });
}
