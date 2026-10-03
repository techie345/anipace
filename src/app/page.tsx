import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Ani<span className="text-indigo-400">Pace</span>
      </h1>
      <p className="mt-4 text-lg text-zinc-400">
        Track your anime and manga at your own pace. Keep lists, score what
        you finish, and import your history from AniList.
      </p>
      <ul className="mx-auto mt-8 max-w-md space-y-2 text-left text-sm text-zinc-300">
        <li className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          📊 Dashboard with stats across anime &amp; manga
        </li>
        <li className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          📚 Separate anime and manga lists with statuses &amp; scores
        </li>
        <li className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          🔍 Search AniList and import your existing lists
        </li>
      </ul>
      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500"
        >
          Sign in with GitHub to start tracking
        </button>
      </form>
      <p className="mt-4 text-xs text-zinc-500">
        No database configured yet — your lists are stored in this browser.
      </p>
    </div>
  );
}
