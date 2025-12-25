import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/otp";
import { hash } from "@node-rs/argon2";

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
    algorithm: 2, // Argon2id
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
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
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

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const id = asString(body?.id);
  const password = asString(body?.password);

  if (!id || !password) {
    return NextResponse.json({ ok: false, error: "Missing id or password" }, { status: 400 });
  }

  if (password.length < 12) {
    return NextResponse.json({ ok: false, error: "Password must be at least 12 characters" }, { status: 400 });
  }

  try {
    const passwordHash = await hash(password, { algorithm: 2 });
    await prisma.adminUser.update({ where: { id }, data: { passwordHash } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (isDbUnavailable(e)) {
      return NextResponse.json({ ok: false, error: "Database unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Failed to update password" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const id = asString(body?.id);
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  if (id === session.user.id) {
    return NextResponse.json({ ok: false, error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const user = await prisma.adminUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Cannot delete super admin" }, { status: 403 });
    }

    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (isDbUnavailable(e)) {
      return NextResponse.json({ ok: false, error: "Database unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Failed to delete admin" }, { status: 400 });
  }
}
