import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAnilistToken, isDbConfigured, listEntries } from "@/lib/db";
import { userKey } from "@/lib/current-user";
import { pushEntryToAniList } from "@/features/sync/anilist-sync";

// POST /api/anilist/push { id: string } — push one local entry to AniList.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured())
    return NextResponse.json(
      { error: "Database required for sync." },
      { status: 503 },
    );
  const uid = userKey(session);
  const token = await getAnilistToken(uid);
  if (!token)
    return NextResponse.json(
      { error: "AniList not connected." },
      { status: 409 },
    );
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const entries = (await listEntries(uid)) ?? [];
  const entry = entries.find((e) => e.id === id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.anilistId == null)
    return NextResponse.json(
      { error: "Entry has no AniList id — add it via Search first." },
      { status: 400 },
    );

  try {
    await pushEntryToAniList(token, {
      anilistId: entry.anilistId,
      status: entry.status,
      progress: entry.progress,
      score: entry.score,
      kind: entry.kind,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Push failed" },
      { status: 502 },
    );
  }
}
