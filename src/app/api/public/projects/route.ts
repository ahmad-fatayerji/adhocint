import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const projects = await prisma.project.findMany({
        where: { published: true },
        orderBy: [{ year: "desc" }, { title: "asc" }],
        select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            year: true,
            description: true,
            images: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                select: {
                    id: true,
                    isCover: true,
                    sortOrder: true,
                    createdAt: true,
                    width: true,
                    height: true,
                },
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
            images: imgs.map((img) => ({
                fullUrl: `/api/public/project-images/${img.id}`,
                thumbUrl: `/api/public/project-images/${img.id}?w=720&h=450`,
                width: img.width,
                height: img.height,
            })),
        };
    });

    return NextResponse.json({ ok: true, projects: out }, { status: 200 });
}
