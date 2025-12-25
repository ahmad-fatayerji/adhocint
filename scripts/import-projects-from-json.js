const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".JPG", ".PNG", ".JPEG", ".WEBP"]);

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeS3() {
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

async function existsObject(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadIfMissing(s3, bucket, key, filePath, contentType) {
  const already = await existsObject(s3, bucket, key);
  if (already) return;
  const body = fs.createReadStream(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || undefined,
    })
  );
}

function guessContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return undefined;
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const bucket = required("MINIO_BUCKET");

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const s3 = makeS3();

  const jsonPath = path.join(process.cwd(), "src", "data", "projects.json");
  const raw = await fsp.readFile(jsonPath, "utf8");
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) throw new Error("projects.json must be an array");

  for (const item of items) {
    const title = String(item.title || "").trim();
    const client = String(item.client || "").trim();
    const year = Number(item.year);
    const description = String(item.description || "").trim();
    const folder = String(item.folder || "").trim();
    const cover = String(item.cover || "").trim();

    if (!title || !client || !Number.isFinite(year) || !description || !folder) {
      console.log("Skipping invalid item:", item);
      continue;
    }

    const slug = slugify(folder);
    const project = await prisma.project.upsert({
      where: { slug },
      update: {
        title,
        year,
        description,
        category: client,
        location: "Lebanon",
        published: true,
      },
      create: {
        slug,
        title,
        year,
        description,
        category: client,
        location: "Lebanon",
        published: true,
      },
    });

    const existingCount = await prisma.projectImage.count({
      where: { projectId: project.id },
    });
    if (existingCount > 0) {
      console.log(`Skipping images for ${slug} (already has ${existingCount})`);
      continue;
    }

    const absFolder = path.join(process.cwd(), "public", "projects", folder);
    let dirEntries;
    try {
      dirEntries = await fsp.readdir(absFolder, { withFileTypes: true });
    } catch {
      console.log(`Folder not found on disk: ${absFolder}`);
      continue;
    }

    const imageFiles = dirEntries
      .filter((d) => d.isFile() && IMG_EXT.has(path.extname(d.name)))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    if (imageFiles.length === 0) {
      console.log(`No images found for ${slug}`);
      continue;
    }

    const coverFile = cover.split("/").pop();
    const ordered = [];
    if (coverFile && imageFiles.includes(coverFile)) {
      ordered.push(coverFile);
    }
    for (const f of imageFiles) {
      if (f !== coverFile) ordered.push(f);
    }

    for (let i = 0; i < ordered.length; i++) {
      const fileName = ordered[i];
      const filePath = path.join(absFolder, fileName);
      const objectKey = `projects/${project.id}/legacy/${i.toString().padStart(3, "0")}-${fileName}`;
      const contentType = guessContentType(fileName);
      const st = await fsp.stat(filePath);

      await uploadIfMissing(s3, bucket, objectKey, filePath, contentType);

      await prisma.projectImage.create({
        data: {
          projectId: project.id,
          objectKey,
          sortOrder: i,
          isCover: i === 0,
          contentType: contentType || null,
          bytes: BigInt(st.size),
        },
      });
    }

    console.log(`Imported: ${slug} (${ordered.length} images)`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
