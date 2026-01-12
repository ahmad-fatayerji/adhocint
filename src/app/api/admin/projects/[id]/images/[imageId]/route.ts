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
    if (normalized === "avif" || normalized === "webp" || normalized === "jpeg" || normalized === "jpg" || normalized === "png") {
        return normalized === "jpg" ? "jpeg" : normalized;
    }
    const accept = acceptHeader?.toLowerCase() || "";
    if (accept.includes("image/avif")) return "avif";
    if (accept.includes("image/webp")) return "webp";
    return "jpeg";
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
    const arrayBuffer = await new Response(stream).arrayBuffer();
    return Buffer.from(arrayBuffer);
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
        const requestedFormat = url.searchParams.get("format");
        const isThumb = Boolean(requestedWidth || requestedHeight || requestedFormat);

        if (isThumb) {
            const width = clamp(requestedWidth ?? requestedHeight ?? 320, 64, 2048);
            const height = clamp(requestedHeight ?? requestedWidth ?? 320, 64, 2048);
            const format = pickFormat(req.headers.get("accept"), requestedFormat);
            const buffer = await streamToBuffer(obj.stream as ReadableStream<Uint8Array>);

            let pipeline = sharp(buffer).resize({
                width,
                height,
                fit: "cover",
                withoutEnlargement: true,
            });

            if (format === "avif") {
                pipeline = pipeline.avif({ quality: 50, effort: 4 });
            } else if (format === "webp") {
                pipeline = pipeline.webp({ quality: 72 });
            } else if (format === "png") {
                pipeline = pipeline.png({ compressionLevel: 8 });
            } else {
                pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
            }

            const out = await pipeline.toBuffer();
            return new NextResponse(out, {
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

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
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
