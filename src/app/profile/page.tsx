import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { isDbConfigured } from "@/lib/db";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const user = session.user;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <p className="font-medium">{user.name ?? "GitHub user"}</p>
          <p className="text-sm text-zinc-400">{user.email ?? "No public email"}</p>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <h2 className="font-medium">Storage</h2>
        <p className="mt-1 text-zinc-400">
          {isDbConfigured()
            ? "Vercel DB (Neon) is connected — lists sync to the database."
            : "No database connected — lists are stored in this browser's localStorage. Connect Neon Postgres later to sync across devices."}
        </p>
        <h2 className="mt-4 font-medium">AniList</h2>
        <p className="mt-1 text-zinc-400">
          Import your public AniList lists by username from the{" "}
          <a href="/search" className="text-indigo-400 hover:underline">
            Search page
          </a>
          . Full AniList OAuth can be added later.
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
