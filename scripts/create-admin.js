const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const argon2 = require("@node-rs/argon2");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    if (a === "--password") out.password = argv[++i];
  }
  return out;
}

async function main() {
  const { email, password } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.js --email you@x.com --password '...'");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const normalizedEmail = String(email).trim().toLowerCase();

  const passwordHash = await argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
  });

  await prisma.adminUser.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash, isActive: true, mfaEnabled: true },
    create: { email: normalizedEmail, passwordHash, isActive: true, mfaEnabled: true },
  });

  console.log(`Admin user ensured: ${normalizedEmail}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
