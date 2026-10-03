import { describe, it, expect, vi, afterEach } from "vitest";
import { displayTitle, searchMedia } from "./anilist";

afterEach(() => vi.unstubAllGlobals());

describe("displayTitle", () => {
  it("prefers english over romaji", () => {
    expect(
      displayTitle({
        id: 1,
        title: { english: "Eng", romaji: "Roma" },
        coverImage: { large: null },
        episodes: 12,
        chapters: null,
        averageScore: 80,
        description: null,
      }),
    ).toBe("Eng");
  });

  it("falls back to romaji then Unknown title", () => {
    expect(
      displayTitle({
        id: 1,
        title: { english: null, romaji: "Roma" },
        coverImage: { large: null },
        episodes: null,
        chapters: null,
        averageScore: null,
        description: null,
      }),
    ).toBe("Roma");
    expect(
      displayTitle({
        id: 1,
        title: { english: null, romaji: null },
        coverImage: { large: null },
        episodes: null,
        chapters: null,
        averageScore: null,
        description: null,
      }),
    ).toBe("Unknown title");
  });
});

describe("searchMedia", () => {
  it("returns media from the GraphQL Page", async () => {
    const media = [
      {
        id: 21,
        title: { english: "One Piece", romaji: null },
        coverImage: { large: "https://img" },
        episodes: 1000,
        chapters: null,
        averageScore: 90,
        description: "pirates",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { Page: { media } } }),
      }),
    );
    await expect(searchMedia("one piece", "ANIME")).resolves.toEqual(media);
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
