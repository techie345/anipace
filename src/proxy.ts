export { auth as proxy } from "@/auth";

export const config = {
  // Keep the session alive on app pages; skip auth API, static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
