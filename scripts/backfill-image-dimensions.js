const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { Readable } = require("node:stream");

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getS3Client() {
  return new S3Client({
    region: "us-east-1",
    endpoint: required("MINIO_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("MINIO_ACCESS_KEY"),
      secretAccessKey: required("MINIO_SECRET_KEY"),
    },
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  const bucket = required("MINIO_BUCKET");
  const concurrency = Math.max(1, Number(process.env.BACKFILL_CONCURRENCY || 4));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const s3 = getS3Client();

  const images = await prisma.projectImage.findMany({
    where: { OR: [{ width: null }, { height: null }] },
    select: { id: true, objectKey: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Backfilling dimensions for ${images.length} images...`);

  let index = 0;
  let active = 0;
  let completed = 0;
  let failures = 0;

  await new Promise((resolve) => {
    const next = () => {
      while (active < concurrency && index < images.length) {
        const img = images[index++];
        active++;
        (async () => {
          try {
            const res = await s3.send(
              new GetObjectCommand({ Bucket: bucket, Key: img.objectKey })
            );
            if (!res || !res.Body) {
              failures++;
              console.warn(`Missing object: ${img.objectKey}`);
              return;
            }
            const body = res.Body;
            const stream =
              typeof body.getReader === "function" ? Readable.fromWeb(body) : body;
            const buffer = await streamToBuffer(stream);
            const meta = await sharp(buffer).rotate().metadata();
            if (!meta.width || !meta.height) {
              failures++;
              console.warn(`No dimensions for ${img.objectKey}`);
              return;
            }
            await prisma.projectImage.update({
              where: { id: img.id },
              data: { width: meta.width, height: meta.height },
            });
            completed++;
            if (completed % 25 === 0 || completed === images.length) {
              console.log(`Processed ${completed}/${images.length}`);
            }
          } catch (err) {
            failures++;
            console.error(`Failed ${img.objectKey}:`, err);
          } finally {
            active--;
            next();
          }
        })();
      }
      if (index >= images.length && active === 0) resolve();
    };
    next();
  });

  console.log(`Done. Success: ${completed}, Failed: ${failures}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
