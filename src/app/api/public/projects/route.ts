import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const projects = await prisma.project.findMany({
        where: { published: true },
        orderBy: [{ year: "desc" }, { title: "asc" }],
        include: {
            images: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
        },
    });

    const out = projects.map((p) => {
        const imgs = p.images.slice();
        const coverIdx = imgs.findIndex((x) => x.isCover);
        if (coverIdx > 0) {
            const [cover] = imgs.splice(coverIdx, 1);
            imgs.unshift(cover);
        }

        return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            client: p.category,
            year: p.year,
            description: p.description,
            images: imgs.map((img) => `/api/public/project-images/${img.id}`),
        };
    });

    return NextResponse.json({ ok: true, projects: out }, { status: 200 });
}
