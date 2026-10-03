import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDbConfigured } from "@/lib/db";
import { buildAuthorizeUrl, getAnilistRedirectUri } from "@/features/sync/anilist-sync";

// GET /api/anilist/auth — redirect the signed-in user to AniList OAuth.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured())
    return NextResponse.json(
      { error: "Database required — connect Neon to store AniList tokens." },
      { status: 503 },
    );
  const clientId = process.env.ANILIST_CLIENT_ID;
  if (!clientId)
    return NextResponse.json(
      { error: "Missing ANILIST_CLIENT_ID — create an app at anilist.co/settings/developer." },
      { status: 500 },
    );
  const redirectUri = getAnilistRedirectUri(req);
  return NextResponse.redirect(buildAuthorizeUrl({ clientId, redirectUri }));
}
