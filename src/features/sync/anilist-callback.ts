import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDbConfigured, saveAnilistToken } from "@/lib/db";
import { userKey } from "@/lib/current-user";
import {
  exchangeCodeForToken,
  getAnilistRedirectUri,
} from "@/features/sync/anilist-sync";

function uidOf(session: { user?: { email?: string | null; name?: string | null } }) {
  return userKey(session);
}

// Shared AniList OAuth callback: exchange ?code= for a token, store it, redirect.
// Used by both /api/anilist/callback and /auth/callback/anilist (alias for
// dashboards that registered the shorter path).
export async function handleAnilistCallback(req: Request) {
  const session = await auth();
  const uid = session?.user ? uidOf(session) : null;
  if (!uid) return NextResponse.redirect(new URL("/?error=signin", req.url));
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/search?anilist=error", req.url));
  if (!isDbConfigured())
    return NextResponse.redirect(new URL("/search?anilist=nodb", req.url));

  const { ANILIST_CLIENT_ID: clientId, ANILIST_CLIENT_SECRET: clientSecret } =
    process.env;
  if (!clientId || !clientSecret)
    return NextResponse.redirect(new URL("/search?anilist=misconfigured", req.url));

  try {
    const token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      redirectUri: getAnilistRedirectUri(req),
      code,
    });
    await saveAnilistToken(uid, token.access_token);
    return NextResponse.redirect(new URL("/search?anilist=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/search?anilist=error", req.url));
  }
}
