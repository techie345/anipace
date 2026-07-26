// Thin wrapper around the public MangaDex REST API.
// Used to fill the gap AniList has for manga: real chapter-release data
// (so we can build a "chapters out that you haven't read" catch-up) and
// real page counts (so time estimates aren't a flat per-chapter guess).

const cache = require("./cache");

const BASE = "https://api.mangadex.org";

// Aggregate (chapter list) changes only when new chapters release - a
// generous TTL here is what actually saves the friend-group from rate limits.
const AGGREGATE_TTL_SECONDS = Number(process.env.MANGADEX_AGGREGATE_CACHE_TTL || 1800); // 30 min
const SEARCH_TTL_SECONDS = Number(process.env.MANGADEX_SEARCH_CACHE_TTL || 900); // 15 min
// A chapter's page count never changes once published - safe to cache for a long time.
const PAGES_TTL_SECONDS = Number(process.env.MANGADEX_PAGES_CACHE_TTL || 60 * 60 * 24 * 30); // 30 days

// Rough, commonly-cited average reading pace. Page counts themselves are
// real MangaDex data; only the seconds-per-page conversion is an assumption.
const SECONDS_PER_PAGE = 12;

async function mdFetch(pathAndQuery) {
  const res = await fetch(BASE + pathAndQuery, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`MangaDex API error ${res.status} for ${pathAndQuery}`);
  }
  return res.json();
}

// Search titles, for the manual link-a-title UI.
async function searchManga(title) {
  const key = `mangadex:search:${title.toLowerCase()}`;
  return cache.cached(key, SEARCH_TTL_SECONDS, async () => {
    const qs = new URLSearchParams();
    qs.set("title", title);
    qs.set("limit", "8");
    qs.append("order[relevance]", "desc");
    const data = await mdFetch(`/manga?${qs.toString()}`);
    return (data.data || []).map((m) => ({
      mangadexId: m.id,
      title: m.attributes.title.en || Object.values(m.attributes.title)[0] || "(untitled)",
      altTitle: (m.attributes.altTitles || []).map((t) => Object.values(t)[0]).find(Boolean) || null,
      year: m.attributes.year || null,
      status: m.attributes.status || null,
    }));
  });
}

// Deduped chapter list (aggregate collapses multiple scanlation groups per
// chapter number into one entry), used to find the latest chapter number.
async function getAggregate(mangadexId, lang = "en", { force = false } = {}) {
  const key = `mangadex:aggregate:${mangadexId}:${lang}`;
  return cache.cached(key, AGGREGATE_TTL_SECONDS, async () => {
    const qs = new URLSearchParams();
    qs.append("translatedLanguage[]", lang);
    const data = await mdFetch(`/manga/${mangadexId}/aggregate?${qs.toString()}`);
    const chapters = [];
    for (const vol of Object.values(data.volumes || {})) {
      for (const ch of Object.values(vol.chapters || {})) {
        const num = parseFloat(ch.chapter);
        if (!Number.isNaN(num)) chapters.push({ number: num, id: ch.id });
      }
    }
    chapters.sort((a, b) => a.number - b.number);
    return chapters;
  }, { force });
}

// Sum real page counts for a set of chapter ids (batched, MangaDex caps at 100/request).
// Cached per-chapter-id (not per batch) since page counts are immutable and
// the same chapters get looked up repeatedly as different people catch up on it.
async function getPagesForChapters(ids) {
  if (!ids.length) return { totalPages: 0, chaptersWithData: 0 };

  const pagesById = {};
  const uncached = [];
  for (const id of ids) {
    const hit = cache.get(`mangadex:pages:${id}`);
    if (hit !== null) pagesById[id] = hit.pages;
    else uncached.push(id);
  }

  if (uncached.length) {
    const qs = new URLSearchParams();
    uncached.slice(0, 100).forEach((id) => qs.append("ids[]", id));
    qs.set("limit", "100");
    const data = await mdFetch(`/chapter?${qs.toString()}`);
    for (const ch of data.data || []) {
      const pages = typeof ch.attributes?.pages === "number" ? ch.attributes.pages : null;
      pagesById[ch.id] = pages;
      cache.set(`mangadex:pages:${ch.id}`, { pages }, PAGES_TTL_SECONDS);
    }
  }

  let totalPages = 0;
  let chaptersWithData = 0;
  for (const p of Object.values(pagesById)) {
    if (typeof p === "number") {
      totalPages += p;
      chaptersWithData++;
    }
  }
  return { totalPages, chaptersWithData };
}

// Full catch-up computation for one linked title: chapters behind + a
// page-based time estimate for the next chunk of them.
async function getCatchUpForManga(mangadexId, progress, lang = "en", { force = false } = {}) {
  const chapters = await getAggregate(mangadexId, lang, { force });
  if (!chapters.length) return { latestChapter: null, behind: 0 };

  const latestChapter = chapters[chapters.length - 1].number;
  const unread = chapters.filter((c) => c.number > progress);
  const behind = unread.length;
  if (behind === 0) return { latestChapter, behind: 0 };

  // Time-estimate a sensible chunk rather than someone's entire 800-chapter backlog.
  const sample = unread.slice(0, 30);
  const { totalPages, chaptersWithData } = await getPagesForChapters(sample.map((c) => c.id));
  const sampledMinutes = totalPages ? (totalPages * SECONDS_PER_PAGE) / 60 : null;
  const minutesEstimate =
    sampledMinutes && chaptersWithData
      ? Math.round((sampledMinutes / chaptersWithData) * behind)
      : null;

  return {
    latestChapter,
    behind,
    nextChapterToRead: unread[0].number,
    minutesEstimate, // null if MangaDex had no page data for the sampled chapters
  };
}

module.exports = { searchManga, getAggregate, getCatchUpForManga, SECONDS_PER_PAGE };
