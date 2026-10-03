import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { displayTitle, importUserLists } from "@/features/discovery/anilist";
import { upsertEntry, isDbConfigured, type EntryStatus } from "@/lib/db";
import { userKey } from "@/lib/current-user";

const STATUS_MAP: Record<string, EntryStatus> = {
  CURRENT: "watching",
  PLANNING: "plan_to_watch",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "on_hold",
  REPEATING: "watching",
};

// POST /api/anilist/import { userName, kind: "anime"|"manga" }
// Imports the public AniList lists into the DB (DB mode) or returns the
// normalized entries for the client to store in localStorage (fallback mode).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userName, kind } = (await req.json()) as {
    userName?: string;
    kind?: string;
  };
  if (!userName?.trim())
    return NextResponse.json({ error: "Missing userName" }, { status: 400 });

  try {
    const { anime, manga } = await importUserLists(userName.trim());
    const picked = kind === "manga" ? manga : anime;
    const uid = userKey(session);

    const entries = picked.map((e) => ({
      kind: (kind === "manga" ? "manga" : "anime") as "anime" | "manga",
      title: displayTitle(e.media),
      coverUrl: e.media.coverImage.large,
      status:
        STATUS_MAP[e.status] ??
        (kind === "manga" ? "plan_to_read" : "plan_to_watch"),
      progress: e.progress ?? 0,
      total: (kind === "manga" ? e.media.chapters : e.media.episodes) ?? null,
      score: e.score ? Math.round((e.score / 100) * 10) : null,
      notes: null as string | null,
      anilistId: e.mediaId,
    }));

    if (!isDbConfigured()) return NextResponse.json({ entries, stored: false });

    let stored = 0;
    for (const e of entries) {
      await upsertEntry(uid, e);
      stored++;
    }
    return NextResponse.json({ entries, stored });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 502 },
    );
  }
}
