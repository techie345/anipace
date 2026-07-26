# anipace

Tells you what to watch/read today to stay on pace, using the [AniList](https://anilist.co) API.

Two independent recommendation engines:

- **Catch up** — for anime you're currently watching that's still airing, compares
  the latest aired episode (via AniList's `nextAiringEpisode`) against your
  progress. No setup needed, works the moment you enter your username.
- **Pace goals** — for anything else (backlog anime, manga, or airing shows you
  want to binge on a schedule), you set a target finish date. Each day the app
  recalculates `episodes/chapters remaining ÷ days left` and tells you how many
  to consume today to land on time.

No login/OAuth — AniList list data is public by username, so this only ever reads.

## Run with Docker (recommended)

```bash
docker compose up -d --build
```

Then open `http://localhost:3000` (or `http://<your-server-ip>:3000` if self-hosting
remotely). Data (your pace goals) persist in a named Docker volume, `anipace-data`.

To update after pulling new code:

```bash
docker compose up -d --build
```

## Run without Docker

Requires Node.js 18+.

```bash
npm install
npm start
```

Serves on `http://localhost:3000` by default. Set `PORT` to change it.

## Manga catch-up (via MangaDex)

AniList has no data on which chapters of an ongoing manga are actually out —
only anime has that (`nextAiringEpisode`). To get real manga catch-up,
anipace optionally links each title in your AniList manga list to its
MangaDex entry:

1. Open the app — any `CURRENT`/`REPEATING` manga without a saved link shows
   up under "Not linked yet" with a search box, pre-filled with the AniList
   title.
2. Search and click the right MangaDex result once. The link is saved
   (SQLite), so you only do this per title, not per visit.
3. From then on, that title shows up in "Catch up — manga" with real chapter
   numbers (MangaDex's aggregate endpoint, deduped across scanlation groups)
   and a reading-time estimate built from actual page counts on a sample of
   the next chapters (page counts are real; the seconds-per-page conversion
   is the only assumed part).

There's no official AniList↔MangaDex ID mapping, which is why linking is a
manual, one-time step rather than automatic.

## Caching

Repeated visits reuse recent data instead of hitting AniList/MangaDex every
time — this matters once more than one person is loading the same instance.
Cached in SQLite (survives container restarts), with these default TTLs,
overridable via env vars:

| What | Env var | Default |
|---|---|---|
| AniList list (progress, airing status) | `ANILIST_LIST_CACHE_TTL` | 300s (5 min) |
| AniList search results | `ANILIST_SEARCH_CACHE_TTL` | 900s (15 min) |
| MangaDex chapter list (aggregate) | `MANGADEX_AGGREGATE_CACHE_TTL` | 1800s (30 min) |
| MangaDex search results | `MANGADEX_SEARCH_CACHE_TTL` | 900s (15 min) |
| MangaDex chapter page counts | `MANGADEX_PAGES_CACHE_TTL` | 30 days (these never change once published) |

The **↻ Refresh** button next to the username field bypasses the cache for
that load — useful right after updating your AniList progress if you don't
want to wait out the 5-minute list TTL.

## Notes for sharing this with friends

Before handing this to other people, know what's still single-user under the
hood:

- **Pace goals and MangaDex links are global**, not scoped per AniList
  username — everyone hitting one instance shares the same goal list and
  title links. Fine for one person or a household; not fine for unrelated
  friends without changes (adding a `username`/account column to those
  tables and threading it through the routes). Say the word if you want that
  built out.
- There's no auth on the app itself — anyone who can reach the URL can add,
  edit, or delete goals and links. Put it behind your own reverse proxy /
  VPN / basic auth if it's going to be reachable outside your LAN.

## Notes / things to know

- **Your AniList list must be public** (default AniList setting) for anipace to read it.
- Time estimates: AniList's `Media.duration` field gives the real average
  episode length for anime, so catch-up and pace cards show an accurate
  "~Xh Ym" for anime. Manga has no equivalent field in the API, so chapter
  time is a rough estimate (6 min/chapter) and is labeled "(est.)" wherever
  it's shown.
- The catch-up view only applies to anime — AniList doesn't expose a manga
  "chapters released so far" schedule the way it does for anime airing, so
  manga always goes through the pace-goals path.
- Pace goals are stored per-title in SQLite (`/app/data/anipace.db` in the
  container). This is intentionally single-user / self-hosted — there's no
  multi-account system. If multiple people use one instance they'll share the
  same goal list.
- The "final day" / "overdue" pill on a pace goal means the target date has
  arrived or passed with progress still remaining — it'll suggest finishing
  the rest in one go, adjust the date instead if that's unrealistic.

## Project layout

```
server.js      Express routes (/api/today, /api/catchup, /api/goals, /api/search, /api/manga-links, /api/mangadex/search)
anilist.js     AniList GraphQL client (list fetch + media search)
mangadex.js    MangaDex REST client (chapter aggregate + page counts)
db.js          SQLite (better-sqlite3) setup for pace goals + AniList↔MangaDex links
public/        Static frontend (vanilla JS, no build step)
Dockerfile / docker-compose.yml
```
