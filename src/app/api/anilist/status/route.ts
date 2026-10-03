import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAnilistToken, isDbConfigured } from "@/lib/db";
import { userKey } from "@/lib/current-user";

// GET /api/anilist/status — { connected: boolean }
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ connected: false, reason: "signed-out" });
  if (!isDbConfigured())
    return NextResponse.json({ connected: false, reason: "no-db" });
  if (!process.env.ANILIST_CLIENT_ID)
    return NextResponse.json({ connected: false, reason: "misconfigured" });
  const uid = userKey(session);
  const token = await getAnilistToken(uid);
  return NextResponse.json({ connected: Boolean(token) });
}
