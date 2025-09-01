import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".JPG", ".PNG", ".JPEG", ".WEBP"]);

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder");
    if (!folder) {
        return NextResponse.json({ error: "Missing folder param" }, { status: 400 });
    }
    // Basic sanitization: forbid path traversal
    if (folder.includes("..") || folder.startsWith("/")) {
        return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    try {
        const abs = path.join(process.cwd(), "public", "projects", folder);
        const entries = await readdir(abs, { withFileTypes: true });
        const files = entries
            .filter((d) => d.isFile() && IMG_EXT.has(path.extname(d.name)))
            .map((d) => `/projects/${folder}/${d.name}`)
            .sort((a, b) => a.localeCompare(b));
        return NextResponse.json({ images: files });
    } catch (e: any) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
}