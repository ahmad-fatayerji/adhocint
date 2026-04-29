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
    const text = `Your verification code is: ${issued.code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

    const digits = issued.code.split('');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3960ad 0%,#958349 100%);padding:32px 40px 28px;text-align:center;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;text-transform:uppercase;">adhoc<span style="opacity:0.75;">int</span></span>
            <p style="margin:14px 0 0;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">Admin Portal</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;text-align:center;">
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0a0a0a;">Verification Code</p>
            <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">
              Use the code below to complete your sign-in.<br/>It expires in <strong style="color:#3960ad;">10 minutes</strong>.
            </p>

            <!-- OTP digits -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                ${digits.map((d, i) => `
                <td style="padding:${i === 2 ? '0 10px 0 0' : '0 4px 0 0'};">
                  <div style="width:48px;height:60px;border-radius:8px;background:#f7f8fb;border:2px solid ${i < 3 ? '#3960ad' : '#958349'};display:inline-block;text-align:center;line-height:60px;font-size:28px;font-weight:700;color:#0a0a0a;font-family:'Courier New',monospace;">${d}</div>
                </td>`).join('')}
              </tr>
            </table>

            <p style="margin:0 0 4px;font-size:12px;color:#aaa;">Didn't request this? You can safely ignore this email.</p>
            <p style="margin:0;font-size:12px;color:#e05252;font-weight:600;">Never share this code with anyone.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7f8fb;padding:18px 40px;border-top:1px solid #e8eaed;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;">
              &copy; ${new Date().getFullYear()} adhocint &mdash; This is an automated security email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
        await sendMail({ to: user.email, subject, text, html });
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

    // Successful send -> clear rate limit counters for this ip and email
    try {
        await prisma.loginRateLimit.deleteMany({
            where: { key: { in: [`ip:${ip}:admin_login`, `email:${email}:admin_login`] } },
        });
    } catch {
        // ignore errors clearing rate limits
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}
