import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SearchClient from "@/features/discovery/SearchClient";

export default async function SearchPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return <SearchClient />;
}
