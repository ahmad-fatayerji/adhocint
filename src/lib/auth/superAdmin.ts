import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/otp";
import { hash } from "@node-rs/argon2";

type SuperAdminConfig =
  | { email: string; password: string }
  | { error: string }
  | null;

function getSuperAdminConfig(): SuperAdminConfig {
  const rawEmail = process.env.SUPER_ADMIN_EMAIL || "";
  const password = process.env.SUPER_ADMIN_PASSWORD || "";

  if (!rawEmail && !password) return null;
  if (!rawEmail || !password) {
    return {
      error: "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set.",
    };
  }

  const email = normalizeEmail(rawEmail);
  if (!email) return { error: "SUPER_ADMIN_EMAIL is invalid." };

  return { email, password };
}

export async function ensureSuperAdminForEmail(email: string) {
  const config = getSuperAdminConfig();
  if (!config) return { ok: true as const };
  if ("error" in config) return { ok: false as const, error: config.error };
  if (email !== config.email) return { ok: true as const };

  const passwordHash = await hash(config.password, {
    algorithm: 2, // Argon2id
  });

  await prisma.adminUser.upsert({
    where: { email: config.email },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
    },
    create: {
      email: config.email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
    },
  });

  return { ok: true as const };
}
