import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";

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

export async function GET() {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    try {
        const projects = await prisma.project.findMany({
            orderBy: [{ year: "desc" }, { title: "asc" }],
        });

        return NextResponse.json({ ok: true, projects }, { status: 200 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { ok: false, error: "Failed to load projects" },
            { status: 400 }
        );
    }
}

export async function POST(req: Request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const slug = normalizeSlug(asString(body?.slug));
    const title = asString(body?.title).trim();
    const location = asString(body?.location).trim();
    const year = asInt(body?.year);
    const category = asString(body?.category).trim();
    const description = asString(body?.description).trim();
    const published = body?.published === undefined ? true : asBoolean(body?.published);

    if (!slug || !title || !location || !category || !description || !Number.isFinite(year)) {
        return NextResponse.json(
            { ok: false, error: "Missing required fields" },
            { status: 400 }
        );
    }

    try {
        const project = await prisma.project.create({
            data: {
                slug,
                title,
                location,
                year,
                category,
                description,
                published,
            },
        });
        return NextResponse.json({ ok: true, project }, { status: 201 });
    } catch (e: any) {
        if (isDbUnavailable(e)) {
            return NextResponse.json(
                { ok: false, error: "Database unavailable" },
                { status: 503 }
            );
        }
        const msg = typeof e?.message === "string" ? e.message : "Failed to create";
        const duplicate = msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate");
        return NextResponse.json(
            { ok: false, error: duplicate ? "Slug already exists" : "Failed to create" },
            { status: 400 }
        );
    }
}
