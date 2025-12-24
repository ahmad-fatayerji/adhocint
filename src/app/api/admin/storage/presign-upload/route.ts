import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { presignPutObject } from "@/lib/minio";

export async function POST(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) return NextResponse.json({ ok: false }, { status: 500 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const objectKey = typeof body?.objectKey === "string" ? body.objectKey : "";
    const contentType = typeof body?.contentType === "string" ? body.contentType : undefined;

    if (!objectKey) return NextResponse.json({ ok: false }, { status: 400 });

    const uploadUrl = await presignPutObject({
        bucket,
        key: objectKey,
        contentType,
        expiresInSeconds: 900,
    });

    return NextResponse.json({ ok: true, uploadUrl, objectKey }, { status: 200 });
}
