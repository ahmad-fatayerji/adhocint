import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeSlug(slug: string) {
    return slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder");
    if (!folder) {
        return NextResponse.json({ error: "Missing folder param" }, { status: 400 });
    }

    const slug = normalizeSlug(folder);
    const project = await prisma.project.findUnique({
        where: { slug },
        include: {
            images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
    });
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const imgs = project.images.slice();
    const coverIdx = imgs.findIndex((x) => x.isCover);
    if (coverIdx > 0) {
        const [cover] = imgs.splice(coverIdx, 1);
        imgs.unshift(cover);
    }

    const images = imgs.map((img) => `/api/public/project-images/${img.id}`);
    return NextResponse.json({ images }, { status: 200 });
}