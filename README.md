# AniPace — Anime & Manga Tracker

Full-stack tracking app built on **Next.js 16** (App Router), **Auth.js v5**
GitHub login, and **AniList** search/import. Deploys to Vercel.

## Features

- GitHub login/logout (Auth.js v5, JWT sessions — no DB required)
- Dashboard, Profile, Anime list, Manga list, Search pages
- Track status / progress / score / notes per title
- Search AniList (public GraphQL, no key) and add titles in one click
- Import your public AniList lists by username
- Storage: browser localStorage now; Neon Postgres (Vercel Marketplace,
  free tier) when you add it — the app detects `DATABASE_URL` automatically

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in GitHub OAuth credentials
npm run dev
```

GitHub OAuth app: https://github.com/settings/developers → New OAuth App.
Callback URL: `http://localhost:3000/api/auth/callback/github`.
Generate `AUTH_SECRET` with `npx auth secret`.

## Deploy on Vercel

The repo is already linked to a Vercel project — push to deploy.
Set env vars in Dashboard → Project → Settings → Environment Variables:

- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (prod callback:
  `https://<your-app>.vercel.app/api/auth/callback/github`)
- `AUTH_SECRET` (generate with `npx auth secret`)
- `AUTH_TRUST_HOST=true` is set in code via `trustHost`

## Adding the database later (Neon, free tier)

1. Vercel Dashboard → Project → Storage → Add Neon Postgres
   (free: 0.5 GB storage, 100 compute-hours/mo, via Marketplace).
2. `DATABASE_URL` is injected automatically — no code change needed.
   The `entries` table self-creates on first query (`src/lib/db.ts`).

No Blob storage is used (covers hotlink AniList CDN, avatars come from GitHub).
