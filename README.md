# AniPace — Anime & Manga Tracker

Full-stack tracking app built on **Next.js 16** (App Router), **Auth.js v5**
GitHub + Discord login, and **AniList** search/import/2-way sync. Deploys to Vercel.

## Features

- GitHub + Discord login/logout (Auth.js v5, JWT sessions — no DB required)
- Dashboard, Profile, Anime list, Manga list, Search pages
- Track status / progress / score / notes per title
- Search AniList (public GraphQL, no key) and add titles in one click
- Import your public AniList lists by username
- AniList 2-way sync (OAuth): pull lists down, push progress up, or both —
  requires `ANILIST_CLIENT_ID/SECRET` + database; see Search page
- Storage: browser localStorage now; Neon Postgres (Vercel Marketplace,
  free tier) when you add it — the app detects `DATABASE_URL` automatically
- Tests: Vitest + Testing Library (`npm test`, 13 tests)

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in GitHub/Discord OAuth credentials
npm run dev
npm test
```

GitHub OAuth app: https://github.com/settings/developers → New OAuth App.
Callback URL: `http://localhost:3000/api/auth/callback/github`.
Discord app: https://discord.com/developers/applications → OAuth2 → Redirects.
Add `http://localhost:3000/api/auth/callback/discord` (scopes: identify, email).
AniList app: https://anilist.co/settings/developer → New Client.
Redirect URL: `http://localhost:3000/api/anilist/callback`.
Generate `AUTH_SECRET` with `npx auth secret`.

## Deploy on Vercel

The repo is already linked to a Vercel project — push to deploy.
Set env vars in Dashboard → Project → Settings → Environment Variables:

- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (prod callback:
  `https://<your-app>.vercel.app/api/auth/callback/github`)
- `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` (prod callback:
  `https://<your-app>.vercel.app/api/auth/callback/discord`)
- `ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` (prod redirect:
  `https://<your-app>.vercel.app/api/anilist/callback`)
- `AUTH_SECRET` (generate with `npx auth secret`)
- `AUTH_TRUST_HOST=true` is set in code via `trustHost`

## Adding the database later (Neon, free tier)

1. Vercel Dashboard → Project → Storage → Add Neon Postgres
   (free: 0.5 GB storage, 100 compute-hours/mo, via Marketplace).
2. `DATABASE_URL` is injected automatically — no code change needed.
   The `entries` table self-creates on first query (`src/lib/db.ts`).

No Blob storage is used (covers hotlink AniList CDN, avatars come from GitHub/Discord).
