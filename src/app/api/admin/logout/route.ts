import { NextResponse } from "next/server";
import { revokeAdminSession } from "@/lib/auth/session";

export async function POST() {
    await revokeAdminSession();
    return NextResponse.json({ ok: true }, { status: 200 });
}
