import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/crypto";

function asString(v: any) {
    return typeof v === "string" ? v : "";
}

function asInt(v: any) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function isDbUnavailable(e: any) {
    const code = e?.code;
    return (
        code === "P1001" ||
        code === "EAI_AGAIN" ||
        (typeof e?.message === "string" &&
            (e.message.includes("EAI_AGAIN") ||
                e.message.includes("Can't reach database server")))
    );
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    try {
        const images = await prisma.projectImage.findMany({
            where: { projectId },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        const withUrls = await Promise.all(
            images.map(async (img) => ({
                id: img.id,
                objectKey: img.objectKey,
                sortOrder: img.sortOrder,
                isCover: img.isCover,
                contentType: img.contentType,
                bytes: img.bytes ? img.bytes.toString() : null,
                url: `/api/admin/projects/${projectId}/images/${img.id}`,
            }))
        );

        return NextResponse.json({ ok: true, images: withUrls }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to load images" },
            { status: 400 }
        );
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId } = await params;
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) {
        return NextResponse.json(
            { ok: false, error: "MINIO_BUCKET is not configured" },
            { status: 500 }
        );
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const filename = asString(body?.filename).trim();
    const contentType = asString(body?.contentType).trim() || undefined;
    const bytes = asInt(body?.bytes);
    if (!filename) {
        return NextResponse.json(
            { ok: false, error: "Missing filename" },
            { status: 400 }
        );
    }

    const ext = filename.includes(".") ? filename.split(".").pop() : "";
    const safeExt = ext && /^[a-zA-Z0-9]+$/.test(ext) ? `.${ext.toLowerCase()}` : "";
    const objectKey = `projects/${projectId}/${randomToken(16)}${safeExt}`;

    try {
        const max = await prisma.projectImage.aggregate({
            where: { projectId },
            _max: { sortOrder: true },
        });
        const nextOrder = (max._max.sortOrder ?? -1) + 1;

        const created = await prisma.projectImage.create({
            data: {
                projectId,
                objectKey,
                sortOrder: nextOrder,
                contentType,
                bytes: Number.isFinite(bytes) ? BigInt(bytes) : null,
            },
        });

        return NextResponse.json(
            {
                ok: true,
                image: { id: created.id, objectKey },
                uploadUrl: `/api/admin/projects/${projectId}/images/${created.id}`,
            },
            { status: 201 }
        );
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to create image" },
            { status: 400 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id: projectId } = await params;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const orderedIds: string[] = Array.isArray(body?.orderedIds)
        ? body.orderedIds.filter((x: any) => typeof x === "string")
        : [];
    const coverId = typeof body?.coverId === "string" ? body.coverId : null;

    if (orderedIds.length === 0) {
        return NextResponse.json(
            { ok: false, error: "orderedIds is required" },
            { status: 400 }
        );
    }

    try {
        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tx.projectImage.updateMany({
                    where: { id: orderedIds[i], projectId },
                    data: { sortOrder: i },
                });
            }

            if (coverId) {
                await tx.projectImage.updateMany({
                    where: { projectId },
                    data: { isCover: false },
                });
                await tx.projectImage.updateMany({
                    where: { id: coverId, projectId },
                    data: { isCover: true },
                });
            }
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
            { ok: false, error: "Failed to update images" },
            { status: 400 }
        );
    }
}
