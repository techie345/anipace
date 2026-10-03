import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ListPage from "@/features/tracking/ListPage";

export default async function AnimePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return <ListPage kind="anime" title="Anime list" />;
}
