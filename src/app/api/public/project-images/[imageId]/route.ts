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

export async function GET(
    _req: Request,
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

        const res = new NextResponse(obj.stream as ReadableStream, {
            status: 200,
            headers: {
                "Content-Type": image.contentType || obj.contentType || "application/octet-stream",
                "Cache-Control": "public, max-age=300",
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
