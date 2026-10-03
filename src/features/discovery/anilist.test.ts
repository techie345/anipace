import { describe, it, expect, vi, afterEach } from "vitest";
import {
  displayTitle,
  humanize,
  releaseYear,
  searchMedia,
  type AniListMedia,
} from "./anilist";

afterEach(() => vi.unstubAllGlobals());

function media(over: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1,
    title: { english: null, romaji: null },
    coverImage: { large: null },
    episodes: null,
    chapters: null,
    averageScore: null,
    description: null,
    genres: [],
    format: null,
    status: null,
    seasonYear: null,
    startDate: null,
    siteUrl: null,
    ...over,
  };
}

describe("displayTitle", () => {
  it("prefers english over romaji", () => {
    expect(
      displayTitle(media({ title: { english: "Eng", romaji: "Roma" } })),
    ).toBe("Eng");
  });

  it("falls back to romaji then Unknown title", () => {
    expect(
      displayTitle(media({ title: { english: null, romaji: "Roma" } })),
    ).toBe("Roma");
    expect(displayTitle(media())).toBe("Unknown title");
  });
});

describe("humanize", () => {
  it("title-cases enum values", () => {
    expect(humanize("NOT_YET_RELEASED")).toBe("Not yet released");
    expect(humanize("TV")).toBe("Tv");
    expect(humanize(null)).toBeNull();
  });
});

describe("releaseYear", () => {
  it("prefers seasonYear over startDate", () => {
    expect(
      releaseYear(media({ seasonYear: 2024, startDate: { year: 2023 } })),
    ).toBe(2024);
    expect(releaseYear(media({ startDate: { year: 2023 } }))).toBe(2023);
    expect(releaseYear(media())).toBeNull();
  });
});

describe("searchMedia", () => {
  it("returns media from the GraphQL Page", async () => {
    const items = [
      media({
        id: 21,
        title: { english: "One Piece", romaji: null },
        coverImage: { large: "https://img" },
        episodes: 1000,
        averageScore: 90,
        description: "pirates",
        genres: ["Adventure"],
        format: "TV",
        status: "RELEASING",
        seasonYear: 1999,
        siteUrl: "https://anilist.co/anime/21",
      }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { Page: { media: items } } }),
      }),
    );
    await expect(searchMedia("one piece", "ANIME")).resolves.toEqual(items);
  });

  it("throws on GraphQL errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errors: [{ message: "boom" }] }),
      }),
    );
    await expect(searchMedia("x", "MANGA")).rejects.toThrow("boom");
  });
});
