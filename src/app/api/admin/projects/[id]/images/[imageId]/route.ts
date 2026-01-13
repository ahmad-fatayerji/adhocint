import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { deleteObject, getObjectStream, putObject } from "@/lib/minio";

function isDbUnavailable(e: unknown) {
    const code = (e as { code?: string })?.code;
    const msg = (e as { message?: string })?.message;
    return (
        code === "P1001" ||
        code === "EAI_AGAIN" ||
        (typeof msg === "string" &&
            (msg.includes("EAI_AGAIN") ||
                msg.includes("Can't reach database server")))
    );
}

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
function parsePositiveInt(value: string | null) {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

const PUBLIC_THUMB_WIDTHS = [480, 720, 960, 1280];
const ADMIN_THUMB_WIDTHS = [320];
const PUBLIC_RATIO = 10 / 16;

function closestWidth(requested: number, allowed: number[]) {
    return allowed.reduce((prev, curr) =>
        Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
    );
}

function thumbKey(objectKey: string, preset: string) {
    return `${objectKey}__thumb_${preset}.webp`;
}

async function uploadThumbs(opts: { bucket: string; objectKey: string; bytes: Uint8Array }) {
    const source = Buffer.from(opts.bytes);
    const base = sharp(source).rotate();

    for (const width of ADMIN_THUMB_WIDTHS) {
        const out = await base
            .clone()
            .resize({
                width,
                height: width,
                fit: "cover",
                withoutEnlargement: true,
            })
            .webp({ quality: 74 })
            .toBuffer();
        await putObject({
            bucket: opts.bucket,
            key: thumbKey(opts.objectKey, `sq_w${width}`),
            body: out,
            contentType: "image/webp",
        });
    }

    for (const width of PUBLIC_THUMB_WIDTHS) {
        const height = Math.round(width * PUBLIC_RATIO);
        const out = await base
            .clone()
            .resize({
                width,
                height,
                fit: "cover",
                withoutEnlargement: true,
            })
            .webp({ quality: 74 })
            .toBuffer();
        await putObject({
            bucket: opts.bucket,
            key: thumbKey(opts.objectKey, `16x10_w${width}`),
            body: out,
            contentType: "image/webp",
        });
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId, imageId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    try {
        const img = await prisma.projectImage.findFirst({
            where: { id: imageId, projectId },
        });
        if (!img) return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });

        const obj = await getObjectWithRetry(bucket, img.objectKey);
        if (!obj) return NextResponse.json({ ok: false, error: "Object not in storage" }, { status: 404 });

        const url = new URL(req.url);
        const requestedWidth = parsePositiveInt(url.searchParams.get("w"));
        const requestedHeight = parsePositiveInt(url.searchParams.get("h"));
        const isThumb = Boolean(requestedWidth || requestedHeight);

        if (isThumb) {
            const width = clamp(requestedWidth ?? requestedHeight ?? 320, 64, 2048);
            const height = clamp(requestedHeight ?? requestedWidth ?? 320, 64, 2048);
            const isSquare = width === height;
            const allowed = isSquare ? ADMIN_THUMB_WIDTHS : PUBLIC_THUMB_WIDTHS;
            const normalizedWidth = closestWidth(width, allowed);
            const preset = isSquare
                ? `sq_w${normalizedWidth}`
                : `16x10_w${normalizedWidth}`;
            const thumb = await getObjectOptional(
                bucket,
                thumbKey(img.objectKey, preset)
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
        }

        const res = new NextResponse(obj.stream as ReadableStream, {
            status: 200,
            headers: {
                "Content-Type": img.contentType || obj.contentType || "application/octet-stream",
                "Cache-Control": "no-store",
            },
        });
        if (typeof obj.contentLength === "number") {
            res.headers.set("Content-Length", String(obj.contentLength));
        }
        if (obj.etag) res.headers.set("ETag", String(obj.etag));
        return res;
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to load image" },
            { status: 400 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId, imageId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    const contentType = req.headers.get("content-type") || undefined;
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) {
        return NextResponse.json(
            { ok: false, error: "Empty upload" },
            { status: 400 }
        );
    }
    if (contentType && !contentType.startsWith("image/")) {
        return NextResponse.json(
            { ok: false, error: "Unsupported image format" },
            { status: 415 }
        );
    }

    try {
        const img = await prisma.projectImage.findFirst({
            where: { id: imageId, projectId },
        });
        if (!img) return NextResponse.json({ ok: false }, { status: 404 });

        await putObject({
            bucket,
            key: img.objectKey,
            body: bytes,
            contentType: contentType || img.contentType || undefined,
        });

        await prisma.projectImage.update({
            where: { id: img.id },
            data: {
                contentType: contentType || img.contentType,
                bytes: BigInt(bytes.byteLength),
            },
        });

        try {
            await sharp(bytes).metadata();
        } catch {
            return NextResponse.json(
                { ok: false, error: "Unsupported image format" },
                { status: 415 }
            );
        }

        await uploadThumbs({
            bucket,
            objectKey: img.objectKey,
            bytes,
        });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        if (typeof e?.message === "string") {
            return NextResponse.json(
                { ok: false, error: e.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to upload image" },
            { status: 400 }
        );
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId, imageId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    try {
        const img = await prisma.projectImage.findFirst({
            where: { id: imageId, projectId },
        });
        if (!img) return NextResponse.json({ ok: false }, { status: 404 });

        await prisma.projectImage.delete({ where: { id: img.id } });

        try {
            await deleteObject({ bucket, key: img.objectKey });
        } catch {
            // object deletion failure should not block DB cleanup
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to delete image" },
            { status: 400 }
        );
    }
}
