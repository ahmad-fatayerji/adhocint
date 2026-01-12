import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getObjectStream } from "@/lib/minio";

async function getObjectWithRetry(bucket: string, key: string, retries = 2) {
    let lastError: unknown;
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await getObjectStream({ bucket, key });
            if (result) return result;
        } catch (e) {
            lastError = e;
            if (i < retries) {
                await new Promise(r => setTimeout(r, 100 * (i + 1)));
            }
        }
    }
    throw lastError || new Error("Failed to get object");
}

function parsePositiveInt(value: string | null) {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function pickFormat(acceptHeader: string | null, explicit?: string | null) {
    const normalized = explicit?.toLowerCase().trim();
    if (
        normalized === "avif" ||
        normalized === "webp" ||
        normalized === "jpeg" ||
        normalized === "jpg" ||
        normalized === "png"
    ) {
        return normalized === "jpg" ? "jpeg" : normalized;
    }
    const accept = acceptHeader?.toLowerCase() || "";
    if (accept.includes("image/avif")) return "avif";
    if (accept.includes("image/webp")) return "webp";
    return "jpeg";
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ imageId: string }> }
) {
    const { imageId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    try {
        const image = await prisma.projectImage.findUnique({
            where: { id: imageId },
            include: { project: true },
        });
        if (!image) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
        if (!image.project.published) return NextResponse.json({ ok: false, error: "Not published" }, { status: 404 });

        const obj = await getObjectWithRetry(bucket, image.objectKey);
        if (!obj) return NextResponse.json({ ok: false, error: "Object missing" }, { status: 404 });

        const url = new URL(req.url);
        const requestedWidth = parsePositiveInt(url.searchParams.get("w"));
        const requestedHeight = parsePositiveInt(url.searchParams.get("h"));
        const requestedFormat = url.searchParams.get("format");
        const isThumb = Boolean(requestedWidth || requestedHeight || requestedFormat);

        if (isThumb) {
            const width = clamp(requestedWidth ?? requestedHeight ?? 720, 120, 2048);
            const height = clamp(requestedHeight ?? requestedWidth ?? 450, 120, 2048);
            const format = pickFormat(req.headers.get("accept"), requestedFormat);
            const buffer = await new Response(
                obj.stream as ReadableStream<Uint8Array>
            ).arrayBuffer();
            let pipeline = sharp(Buffer.from(buffer)).resize({
                width,
                height,
                fit: "cover",
                withoutEnlargement: true,
            });

            if (format === "avif") {
                pipeline = pipeline.avif({ quality: 55, effort: 4 });
            } else if (format === "webp") {
                pipeline = pipeline.webp({ quality: 74 });
            } else if (format === "png") {
                pipeline = pipeline.png({ compressionLevel: 8 });
            } else {
                pipeline = pipeline.jpeg({ quality: 78, mozjpeg: true });
            }

            const out = await pipeline.toBuffer();
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(out);
                    controller.close();
                },
            });
            return new NextResponse(body, {
                status: 200,
                headers: {
                    "Content-Type": `image/${format}`,
                    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                    "Vary": "Accept",
                },
            });
        }

        const res = new NextResponse(obj.stream as ReadableStream, {
            status: 200,
            headers: {
                "Content-Type": image.contentType || obj.contentType || "application/octet-stream",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
        });
        if (typeof obj.contentLength === "number") {
            res.headers.set("Content-Length", String(obj.contentLength));
        }
        if (obj.etag) res.headers.set("ETag", String(obj.etag));
        return res;
    } catch (e) {
        console.error("Image fetch error:", imageId, e);
        return NextResponse.json({ ok: false, error: "Failed to load" }, { status: 500 });
    }
}
