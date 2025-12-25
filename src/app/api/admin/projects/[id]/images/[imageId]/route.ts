import { NextResponse } from "next/server";
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

export async function GET(
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
        if (!img) return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });

        const obj = await getObjectWithRetry(bucket, img.objectKey);
        if (!obj) return NextResponse.json({ ok: false, error: "Object not in storage" }, { status: 404 });

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
