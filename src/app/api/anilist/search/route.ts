import { NextResponse } from "next/server";
import {
  displayTitle,
  humanize,
  releaseYear,
  searchMedia,
} from "@/features/discovery/anilist";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  const type = params.get("type") === "MANGA" ? "MANGA" : "ANIME";
  if (!q) return NextResponse.json({ results: [] });
  try {
    const media = await searchMedia(q, type as "ANIME" | "MANGA");
    return NextResponse.json({
      results: media.map((m) => ({
        anilistId: m.id,
        title: displayTitle(m),
        coverUrl: m.coverImage.large,
        total: type === "ANIME" ? m.episodes : m.chapters,
        score: m.averageScore == null ? null : Math.round(m.averageScore / 10),
        description: m.description,
        genres: m.genres ?? [],
        format: humanize(m.format),
        status: humanize(m.status),
        year: releaseYear(m),
        siteUrl: m.siteUrl,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 502 },
    );
  }
}
