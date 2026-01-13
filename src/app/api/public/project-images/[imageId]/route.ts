import { NextResponse } from "next/server";
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

async function getObjectOptional(bucket: string, key: string) {
    try {
        return await getObjectStream({ bucket, key });
    } catch {
        return null;
    }
}
const PUBLIC_THUMB_WIDTHS = [480, 720, 960, 1280, 1600, 1920];
const PUBLIC_RATIO = 10 / 16;

function parsePositiveInt(value: string | null) {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function closestWidth(requested: number, allowed: number[]) {
    return allowed.reduce((prev, curr) =>
        Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
    );
}

function thumbKey(objectKey: string, preset: string) {
    return `${objectKey}__thumb_${preset}.webp`;
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
        const isThumb = Boolean(requestedWidth || requestedHeight);

        if (isThumb) {
            const width = clamp(requestedWidth ?? requestedHeight ?? 720, 120, 2048);
            const normalizedWidth = closestWidth(width, PUBLIC_THUMB_WIDTHS);
            const preset = requestedHeight
                ? `16x10_w${normalizedWidth}`
                : `w${normalizedWidth}`;
            const thumb = await getObjectOptional(
                bucket,
                thumbKey(image.objectKey, preset)
            );
            if (thumb) {
                const res = new NextResponse(thumb.stream as ReadableStream, {
                    status: 200,
                    headers: {
                        "Content-Type": "image/webp",
                        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                    },
                });
                if (typeof thumb.contentLength === "number") {
                    res.headers.set("Content-Length", String(thumb.contentLength));
                }
                if (thumb.etag) res.headers.set("ETag", String(thumb.etag));
                return res;
            }
            // Fall through to full image if thumbnail is not available yet.
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
