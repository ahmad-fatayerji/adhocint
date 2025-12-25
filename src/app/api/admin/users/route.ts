import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/otp";
import { Algorithm, hash } from "@node-rs/argon2";

function asString(v: any) {
  return typeof v === "string" ? v : "";
}

function isDbUnavailable(e: any) {
  const code = e?.code;
  return (
    code === "P1001" ||
    code === "EAI_AGAIN" ||
    (typeof e?.message === "string" &&
      (e.message.includes("EAI_AGAIN") ||
        e.message.includes("Can't reach database server")))
  );
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 }
    );
  }

  const email = normalizeEmail(asString(body?.email));
  const password = asString(body?.password);

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 12) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 12 characters" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
  });

  try {
    const user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        mfaEnabled: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (isDbUnavailable(e)) {
      return NextResponse.json(
        { ok: false, error: "Database unavailable" },
        { status: 503 }
      );
    }
    const msg = typeof e?.message === "string" ? e.message : "";
    const duplicate = msg.toLowerCase().includes("unique");
    return NextResponse.json(
      { ok: false, error: duplicate ? "Email already exists" : "Failed to create admin" },
      { status: 400 }
    );
  }
}
