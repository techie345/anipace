// A tiny TTL cache backed by SQLite (so it survives container restarts,
// unlike a plain in-memory Map). Used to keep repeated /api/today loads —
// especially once multiple people share one instance — from re-fetching the
// same AniList lists / MangaDex data over and over.

const db = require("./db");

const getStmt = db.prepare("SELECT value, expires_at FROM http_cache WHERE key = ?");
const deleteStmt = db.prepare("DELETE FROM http_cache WHERE key = ?");
const setStmt = db.prepare(`
  INSERT INTO http_cache (key, value, expires_at) VALUES (@key, @value, @expiresAt)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
`);

function get(key) {
  const row = getStmt.get(key);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteStmt.run(key);
    return null;
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function set(key, value, ttlSeconds) {
  setStmt.run({ key, value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
}

// Wrap an async fetcher with cache-aside behavior.
// Pass `force: true` to skip the cache read (still writes the fresh result).
async function cached(key, ttlSeconds, fetcher, { force = false } = {}) {
  if (!force) {
    const hit = get(key);
    if (hit !== null) return hit;
  }
  const value = await fetcher();
  set(key, value, ttlSeconds);
  return value;
}

// Occasionally sweep expired rows so the table doesn't grow unbounded.
// Cheap enough to just run on a timer rather than adding a cron dependency.
function sweepExpired() {
  db.prepare("DELETE FROM http_cache WHERE expires_at < ?").run(Date.now());
}
setInterval(sweepExpired, 30 * 60 * 1000).unref();

module.exports = { get, set, cached, sweepExpired };
