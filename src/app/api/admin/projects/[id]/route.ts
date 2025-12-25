import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";

const DEFAULT_LOCATION = "N/A";

function asString(v: any) {
    return typeof v === "string" ? v : "";
}

function asBoolean(v: any) {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return false;
}

function asInt(v: any) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function normalizeSlug(slug: string) {
    return slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
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

    const { id } = await params;
    try {
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) return NextResponse.json({ ok: false }, { status: 404 });

        return NextResponse.json({ ok: true, project }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to load project" },
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

    const { id } = await params;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const slug = normalizeSlug(asString(body?.slug));
    const title = asString(body?.title).trim();
    const location = asString(body?.location).trim() || DEFAULT_LOCATION;
    const year = asInt(body?.year);
    const category = asString(body?.category).trim();
    const description = asString(body?.description).trim();
    const published = asBoolean(body?.published);

    if (!slug || !title || !category || !description || !Number.isFinite(year)) {
        return NextResponse.json(
            { ok: false, error: "Missing required fields" },
            { status: 400 }
        );
    }

    try {
        const project = await prisma.project.update({
            where: { id },
            data: { slug, title, location, year, category, description, published },
        });
        return NextResponse.json({ ok: true, project }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        const msg = typeof e?.message === "string" ? e.message : "Failed to update";
        const duplicate = msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate");
        return NextResponse.json(
            { ok: false, error: duplicate ? "Slug already exists" : "Failed to update" },
            { status: 400 }
        );
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { id } = await params;
    try {
        await prisma.project.delete({ where: { id } });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to delete project" },
            { status: 400 }
        );
    }
}
