const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { Readable } = require("node:stream");

const PUBLIC_THUMB_WIDTHS = [480, 720, 960, 1280];
const ADMIN_THUMB_WIDTHS = [320];
const PUBLIC_RATIO = 10 / 16;

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getS3Client() {
  const endpoint = required("MINIO_ENDPOINT");
  const accessKeyId = required("MINIO_ACCESS_KEY");
  const secretAccessKey = required("MINIO_SECRET_KEY");
  return new S3Client({
    region: "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function thumbKey(objectKey, preset) {
  return `${objectKey}__thumb_${preset}.webp`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function getObjectStream(client, bucket, key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res || !res.Body) return null;
  const body = res.Body;
  const stream = typeof body.getReader === "function" ? Readable.fromWeb(body) : body;
  return {
    stream,
    contentType: res.ContentType,
    contentLength: typeof res.ContentLength === "number" ? res.ContentLength : undefined,
  };
}

async function putObject(client, bucket, key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function uploadThumbs(client, bucket, objectKey, buffer) {
  const base = sharp(buffer).rotate();

  for (const width of ADMIN_THUMB_WIDTHS) {
    const out = await base
      .clone()
      .resize({ width, height: width, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    await putObject(client, bucket, thumbKey(objectKey, `sq_w${width}`), out, "image/webp");
  }

  for (const width of PUBLIC_THUMB_WIDTHS) {
    const height = Math.round(width * PUBLIC_RATIO);
    const out = await base
      .clone()
      .resize({ width, height, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    await putObject(client, bucket, thumbKey(objectKey, `16x10_w${width}`), out, "image/webp");
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const bucket = required("MINIO_BUCKET");
  const concurrency = Math.max(1, Number(process.env.THUMBS_CONCURRENCY || 2));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const s3 = getS3Client();

  const images = await prisma.projectImage.findMany({
    select: { id: true, objectKey: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Regenerating thumbs for ${images.length} images...`);

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
            const obj = await getObjectStream(s3, bucket, img.objectKey);
            if (!obj) {
              failures++;
              console.warn(`Missing object: ${img.objectKey}`);
              return;
            }
            const buffer = await streamToBuffer(obj.stream);
            await uploadThumbs(s3, bucket, img.objectKey, buffer);
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

      if (index >= images.length && active === 0) {
        resolve();
      }
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
