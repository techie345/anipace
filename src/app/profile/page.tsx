import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import {
  getAnilistToken,
  isDbConfigured,
  statsFor,
} from "@/lib/db";
import { userKey } from "@/lib/current-user";
import AniListSyncControls from "@/features/sync/AniListSyncControls";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const user = session.user;
  const uid = userKey(session);
  const db = isDbConfigured();
  const [stats, anilistToken] = await Promise.all([
    statsFor(uid).catch(() => null),
    getAnilistToken(uid).catch(() => null),
  ]);
  const anilistConnected = Boolean(anilistToken);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="font-medium">{user.name ?? "Signed-in user"}</p>
          <p className="truncate text-sm text-zinc-400">
            {user.email ?? "No public email"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Sign in with GitHub or Discord on the same email to share one
            library.
          </p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-1 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Signed in
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Anime", value: stats?.anime },
          { label: "Manga", value: stats?.manga },
          { label: "Completed", value: stats?.completed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center"
          >
            <p className="text-2xl font-bold text-indigo-400">
              {s.value ?? "—"}
            </p>
            <p className="text-xs text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>
      {!stats && (
        <p className="-mt-3 text-xs text-zinc-500">
          Counts appear once a database is connected; until then lists live in
          this browser.
        </p>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">AniList sync</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${anilistConnected ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
          >
            {anilistConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-1 text-zinc-400">
          Import your public AniList lists by username from the{" "}
          <a href="/search" className="text-indigo-400 hover:underline">
            Search page
          </a>
          . For 2-way sync,{" "}
          {anilistConnected ? (
            <>
              your account is linked — pull, push, or sync both ways below.
            </>
          ) : (
            <>
              connect via{" "}
              <a
                href="/api/anilist/auth"
                className="text-indigo-400 hover:underline"
              >
                AniList OAuth
              </a>{" "}
              (needs ANILIST_CLIENT_ID/SECRET + database).
            </>
          )}
        </p>
      </div>

      <AniListSyncControls />

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <h2 className="font-medium">Storage</h2>
        <p className="mt-1 text-zinc-400">
          {db
            ? "Vercel DB (Neon) is connected — lists sync to the database."
            : "No database connected — lists are stored in this browser's localStorage. Connect Neon Postgres later to sync across devices."}
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
