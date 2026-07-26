// Thin wrapper around the AniList public GraphQL API.
// No auth required for reading public lists - we just need the AniList username.

const cache = require("./cache");

const ANILIST_URL = "https://graphql.anilist.co";

// How long to trust a cached AniList response before refetching.
// Lists change whenever someone updates progress, so keep this short.
const LIST_TTL_SECONDS = Number(process.env.ANILIST_LIST_CACHE_TTL || 300); // 5 min
const SEARCH_TTL_SECONDS = Number(process.env.ANILIST_SEARCH_CACHE_TTL || 900); // 15 min

async function gql(query, variables) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`AniList API error: ${msg}`);
  }
  return json.data;
}

const LIST_QUERY = `
query ($userName: String, $type: MediaType) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      status
      entries {
        id
        progress
        status
        media {
          id
          type
          status
          episodes
          chapters
          duration
          title { userPreferred }
          coverImage { medium large }
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  }
}`;

// Fetch every list entry (any status) for a user, for ANIME or MANGA.
// Returns a flat array of entries. Cached per user+type.
async function fetchUserList(userName, type, { force = false } = {}) {
  const key = `anilist:list:${userName}:${type}`;
  return cache.cached(key, LIST_TTL_SECONDS, async () => {
    const data = await gql(LIST_QUERY, { userName, type });
    const lists = data?.MediaListCollection?.lists || [];
    const entries = [];
    for (const list of lists) {
      for (const entry of list.entries) {
        entries.push(entry);
      }
    }
    return entries;
  }, { force });
}

const SEARCH_QUERY = `
query ($search: String, $type: MediaType) {
  Page(perPage: 8) {
    media(search: $search, type: $type) {
      id
      type
      status
      episodes
      chapters
      duration
      title { userPreferred }
      coverImage { medium }
    }
  }
}`;

async function searchMedia(search, type) {
  const key = `anilist:search:${type}:${search.toLowerCase()}`;
  return cache.cached(key, SEARCH_TTL_SECONDS, async () => {
    const data = await gql(SEARCH_QUERY, { search, type });
    return data?.Page?.media || [];
  });
}

// AniList doesn't provide a per-chapter read-time for manga (no page-timing
// data in the schema). This is a rough, commonly-cited estimate only.
const ESTIMATED_MANGA_MINUTES_PER_CHAPTER = 6;

module.exports = { fetchUserList, searchMedia, ESTIMATED_MANGA_MINUTES_PER_CHAPTER };
