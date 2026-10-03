import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SearchClient from "@/features/discovery/SearchClient";
import AniListSyncControls from "@/features/sync/AniListSyncControls";

export default async function SearchPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return (
    <div className="space-y-6">
      <AniListSyncControls />
      <SearchClient />
    </div>
  );
}
