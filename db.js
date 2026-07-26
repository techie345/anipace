const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "anipace.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('ANIME','MANGA')),
  title TEXT NOT NULL,
  cover TEXT,
  total_units INTEGER,
  duration_minutes INTEGER,
  duration_is_estimate INTEGER DEFAULT 0,
  target_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(media_id, media_type)
);

CREATE TABLE IF NOT EXISTS manga_links (
  anilist_id INTEGER PRIMARY KEY,
  mangadex_id TEXT NOT NULL,
  mangadex_title TEXT,
  language TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS http_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
`);

module.exports = db;
