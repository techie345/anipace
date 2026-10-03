import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // GitHub speaks OAuth 2.0 with an OIDC-compliant userinfo flow;
  // Auth.js reads client id/secret from AUTH_GITHUB_ID / AUTH_GITHUB_SECRET.
  providers: [GitHub],
  trustHost: true,
});
