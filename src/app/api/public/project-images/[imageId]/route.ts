import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectStream } from "@/lib/minio";

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

    const image = await prisma.projectImage.findUnique({
        where: { id: imageId },
        include: { project: true },
    });
    if (!image) return NextResponse.json({ ok: false }, { status: 404 });
    if (!image.project.published) return NextResponse.json({ ok: false }, { status: 404 });

    const obj = await getObjectStream({ bucket, key: image.objectKey });
    if (!obj) return NextResponse.json({ ok: false }, { status: 404 });

    const res = new NextResponse(obj.stream as any, {
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
}
