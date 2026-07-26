const express = require("express");
const path = require("path");
const db = require("./db");
const { fetchUserList, searchMedia, ESTIMATED_MANGA_MINUTES_PER_CHAPTER } = require("./anilist");
const mangadex = require("./mangadex");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// ---------- helpers ----------

function daysBetween(fromDate, toDate) {
  const MS_DAY = 24 * 60 * 60 * 1000;
  const a = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b - a) / MS_DAY);
}

// Given current progress, a total unit count, and a target finish date,
// work out how many episodes/chapters to consume today to stay on schedule.
function computePace(progress, totalUnits, targetDateStr) {
  const today = new Date();
  const target = new Date(targetDateStr + "T00:00:00Z");
  const remaining = totalUnits != null ? Math.max(totalUnits - progress, 0) : null;

  if (remaining === 0) {
    return { remaining: 0, daysLeft: 0, recommendedToday: 0, status: "done" };
  }

  const daysLeft = daysBetween(today, target);

  if (daysLeft <= 0) {
    // Target date has passed (or is today) and there's still work left: front-load it.
    return {
      remaining,
      daysLeft: 0,
      recommendedToday: remaining ?? 1,
      status: daysLeft < 0 ? "overdue" : "final-day",
    };
  }

  const recommendedToday = remaining != null ? Math.ceil(remaining / daysLeft) : 1;
  return { remaining, daysLeft, recommendedToday, status: "on-track" };
}

// ---------- routes ----------

async function getCatchUp(username, { force = false } = {}) {
  const entries = await fetchUserList(username, "ANIME", { force });
  const result = [];

  for (const entry of entries) {
    const m = entry.media;
    if (!m) continue;

    let airedEpisodes = null;
    if (m.status === "RELEASING" && m.nextAiringEpisode) {
      airedEpisodes = m.nextAiringEpisode.episode - 1;
    } else if (m.status === "FINISHED" && m.episodes) {
      airedEpisodes = m.episodes;
    }
    if (airedEpisodes == null) continue;

    const behind = airedEpisodes - entry.progress;
    if (behind > 0 && (entry.status === "CURRENT" || entry.status === "REPEATING")) {
      result.push({
        mediaId: m.id,
        title: m.title.userPreferred,
        cover: m.coverImage.medium,
        progress: entry.progress,
        airedEpisodes,
        behind,
        nextEpisodeToWatch: entry.progress + 1,
        releasing: m.status === "RELEASING",
        nextAiringAt: m.nextAiringEpisode ? m.nextAiringEpisode.airingAt : null,
        durationMinutes: m.duration || null, // AniList's average-episode-length field
        totalMinutes: m.duration ? m.duration * behind : null,
      });
    }
  }

  result.sort((a, b) => b.behind - a.behind);
  return result;
}

// Airing catch-up: for anime currently airing, compare aired episode count vs progress.
app.get("/api/catchup", async (req, res) => {
  const { username, refresh } = req.query;
  if (!username) return res.status(400).json({ error: "username is required" });
  try {
    res.json(await getCatchUp(username, { force: refresh === "1" }));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// ---------- manga catch-up (via MangaDex link) ----------

async function getMangaCatchUp(username, { force = false } = {}) {
  const entries = await fetchUserList(username, "MANGA", { force });
  const links = new Map(
    db.prepare("SELECT * FROM manga_links").all().map((l) => [l.anilist_id, l])
  );

  const linked = [];
  const unlinked = [];

  for (const entry of entries) {
    const m = entry.media;
    if (!m) continue;
    if (entry.status !== "CURRENT" && entry.status !== "REPEATING") continue;

    const link = links.get(m.id);
    if (!link) {
      unlinked.push({ mediaId: m.id, title: m.title.userPreferred, cover: m.coverImage.medium, progress: entry.progress });
      continue;
    }

    try {
      const result = await mangadex.getCatchUpForManga(link.mangadex_id, entry.progress, link.language || "en", { force });
      if (result.behind > 0) {
        linked.push({
          mediaId: m.id,
          title: m.title.userPreferred,
          cover: m.coverImage.medium,
          progress: entry.progress,
          mangadexId: link.mangadex_id,
          latestChapter: result.latestChapter,
          behind: result.behind,
          nextChapterToRead: result.nextChapterToRead,
          minutesEstimate: result.minutesEstimate,
        });
      }
    } catch (err) {
      console.error(`MangaDex lookup failed for AniList media ${m.id} (linked to ${link.mangadex_id}):`, err.message);
    }
  }

  linked.sort((a, b) => b.behind - a.behind);
  return { linked, unlinked };
}

// Search MangaDex titles, for the manual link-a-title UI.
app.get("/api/mangadex/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    res.json(await mangadex.searchManga(q));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/manga-links", (req, res) => {
  res.json(db.prepare("SELECT * FROM manga_links").all());
});

app.post("/api/manga-links", (req, res) => {
  const { anilistId, mangadexId, mangadexTitle, language } = req.body;
  if (!anilistId || !mangadexId) {
    return res.status(400).json({ error: "anilistId and mangadexId are required" });
  }
  db.prepare(`
    INSERT INTO manga_links (anilist_id, mangadex_id, mangadex_title, language)
    VALUES (@anilistId, @mangadexId, @mangadexTitle, @language)
    ON CONFLICT(anilist_id) DO UPDATE SET
      mangadex_id=excluded.mangadex_id, mangadex_title=excluded.mangadex_title, language=excluded.language
  `).run({ anilistId, mangadexId, mangadexTitle: mangadexTitle || null, language: language || "en" });
  res.status(201).json({ ok: true });
});

app.delete("/api/manga-links/:anilistId", (req, res) => {
  db.prepare("DELETE FROM manga_links WHERE anilist_id = ?").run(req.params.anilistId);
  res.json({ ok: true });
});

// Pace goals: manual per-title targets, works for anime and manga alike.
app.get("/api/goals", (req, res) => {
  const rows = db.prepare("SELECT * FROM goals ORDER BY target_date ASC").all();
  res.json(rows);
});

app.post("/api/goals", (req, res) => {
  const { mediaId, mediaType, title, cover, totalUnits, targetDate, durationMinutes } = req.body;
  if (!mediaId || !mediaType || !title || !targetDate) {
    return res.status(400).json({ error: "mediaId, mediaType, title, targetDate are required" });
  }
  // Anime: use AniList's real average-episode duration when we have it.
  // Manga: AniList has no per-chapter read-time field, so fall back to a rough estimate.
  const isEstimate = mediaType === "MANGA";
  const resolvedDuration = mediaType === "ANIME"
    ? durationMinutes || null
    : ESTIMATED_MANGA_MINUTES_PER_CHAPTER;

  try {
    const stmt = db.prepare(`
      INSERT INTO goals (media_id, media_type, title, cover, total_units, target_date, duration_minutes, duration_is_estimate)
      VALUES (@mediaId, @mediaType, @title, @cover, @totalUnits, @targetDate, @durationMinutes, @isEstimate)
      ON CONFLICT(media_id, media_type) DO UPDATE SET
        title=excluded.title, cover=excluded.cover,
        total_units=excluded.total_units, target_date=excluded.target_date,
        duration_minutes=excluded.duration_minutes, duration_is_estimate=excluded.duration_is_estimate
    `);
    stmt.run({
      mediaId, mediaType, title,
      cover: cover || null,
      totalUnits: totalUnits || null,
      targetDate,
      durationMinutes: resolvedDuration,
      isEstimate: isEstimate ? 1 : 0,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/goals/:id", (req, res) => {
  db.prepare("DELETE FROM goals WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Search AniList media, used to add a new pace goal.
app.get("/api/search", async (req, res) => {
  const { q, type } = req.query;
  if (!q) return res.json([]);
  try {
    const media = await searchMedia(q, (type || "ANIME").toUpperCase());
    res.json(
      media.map((m) => ({
        mediaId: m.id,
        type: m.type,
        title: m.title.userPreferred,
        cover: m.coverImage.medium,
        totalUnits: m.type === "ANIME" ? m.episodes : m.chapters,
        durationMinutes: m.type === "ANIME" ? m.duration : null,
        status: m.status,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// The combined "what should I watch/read today" view.
app.get("/api/today", async (req, res) => {
  const { username, refresh } = req.query;
  const force = refresh === "1";

  try {
    // 1. Catch-up (airing anime + linked manga) - only if a username was supplied.
    let catchUp = [];
    let mangaCatchUp = { linked: [], unlinked: [] };
    if (username) {
      [catchUp, mangaCatchUp] = await Promise.all([
        getCatchUp(username, { force }),
        getMangaCatchUp(username, { force }),
      ]);
    }

    // 2. Pace goals - fetch live progress from AniList for each goal's media.
    const goals = db.prepare("SELECT * FROM goals").all();
    let progressMap = {};
    if (username && goals.length) {
      const [animeEntries, mangaEntries] = await Promise.all([
        fetchUserList(username, "ANIME", { force }),
        fetchUserList(username, "MANGA", { force }),
      ]);
      for (const e of [...animeEntries, ...mangaEntries]) {
        progressMap[`${e.media.type}:${e.media.id}`] = e.progress;
      }
    }

    const paceToday = goals.map((g) => {
      const progress = progressMap[`${g.media_type}:${g.media_id}`] ?? 0;
      const pace = computePace(progress, g.total_units, g.target_date);
      return {
        id: g.id,
        mediaId: g.media_id,
        mediaType: g.media_type,
        title: g.title,
        cover: g.cover,
        progress,
        totalUnits: g.total_units,
        targetDate: g.target_date,
        durationMinutes: g.duration_minutes,
        durationIsEstimate: !!g.duration_is_estimate,
        minutesToday: g.duration_minutes ? g.duration_minutes * pace.recommendedToday : null,
        ...pace,
      };
    });

    res.json({ catchUp, mangaCatchUp, paceToday });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`anipace running on http://localhost:${PORT}`);
});
