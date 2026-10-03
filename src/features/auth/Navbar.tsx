import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export default async function Navbar() {
  const session = await auth();
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-10 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Ani<span className="text-indigo-400">Pace</span>
        </Link>
        {session?.user && (
          <div className="flex gap-3 text-sm text-zinc-300">
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/anime" className="hover:text-white">Anime</Link>
            <Link href="/manga" className="hover:text-white">Manga</Link>
            <Link href="/search" className="hover:text-white">Search</Link>
            <Link href="/profile" className="hover:text-white">Profile</Link>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <span className="hidden text-zinc-400 sm:inline">
                {session.user.name}
              </span>
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="rounded-md bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <form
                action={async () => {
                  "use server";
                  await signIn("github");
                }}
              >
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium hover:bg-indigo-500"
                >
                  Sign in with GitHub
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("discord");
                }}
              >
                <button
                  type="submit"
                  className="rounded-md bg-[#5865F2] px-3 py-1.5 font-medium hover:brightness-110"
                >
                  Sign in with Discord
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
