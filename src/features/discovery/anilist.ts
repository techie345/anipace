// AniList public GraphQL API — no key needed for search / public list reads.
const ENDPOINT = "https://graphql.anilist.co";

async function gql<T>(query: string, variables: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface AniListMedia {
  id: number;
  title: { english: string | null; romaji: string | null };
  coverImage: { large: string | null };
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null; // 0-100
  description: string | null;
  genres: string[];
  format: string | null; // TV, MOVIE, MANGA, NOVEL, ...
  status: string | null; // FINISHED, RELEASING, NOT_YET_RELEASED, ...
  seasonYear: number | null; // anime only
  startDate: { year: number | null } | null;
  siteUrl: string | null;
}

export function displayTitle(m: AniListMedia) {
  return m.title.english ?? m.title.romaji ?? "Unknown title";
}

/** "NOT_YET_RELEASED" → "Not yet released". Pass through null/empty. */
export function humanize(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Release year: anime seasonYear, otherwise manga startDate year. */
export function releaseYear(m: AniListMedia): number | null {
  return m.seasonYear ?? m.startDate?.year ?? null;
}

export async function searchMedia(
  search: string,
  type: "ANIME" | "MANGA",
  perPage = 12,
): Promise<AniListMedia[]> {
  const data = await gql<{ Page: { media: AniListMedia[] } }>(
    `query ($search: String, $type: MediaType, $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, type: $type, sort: POPULARITY_DESC) {
          id title { english romaji } coverImage { large }
          episodes chapters averageScore description(asHtml: false)
          genres format status seasonYear startDate { year } siteUrl
        }
      }
    }`,
    { search, type, perPage },
  );
  return data.Page.media;
}

export interface AniListListEntry {
  mediaId: number;
  status: string;
  progress: number;
  score: number;
  media: AniListMedia & { episodes: number | null; chapters: number | null };
}

// Import a public AniList user's anime+manga lists by username (no OAuth needed).
export async function importUserLists(userName: string) {
  const data = await gql<{
    MediaListCollection: {
      lists: { entries: AniListListEntry[] }[];
    } | null;
  }>(
    `query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists { entries {
          mediaId status progress score
          media { id title { english romaji } coverImage { large } episodes chapters averageScore description(asHtml: false) }
        } }
      }
    }`,
    { userName },
  );
  const anime = data.MediaListCollection?.lists.flatMap((l) => l.entries) ?? [];

  const mangaData = await gql<{
    MediaListCollection: {
      lists: { entries: AniListListEntry[] }[];
    } | null;
  }>(
    `query ($userName: String) {
      MediaListCollection(userName: $userName, type: MANGA) {
        lists { entries {
          mediaId status progress score
          media { id title { english romaji } coverImage { large } episodes chapters averageScore description(asHtml: false) }
        } }
      }
    }`,
    { userName },
  );
  const manga =
    mangaData.MediaListCollection?.lists.flatMap((l) => l.entries) ?? [];
  return { anime, manga };
}
