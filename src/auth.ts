import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // GitHub reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET.
  // Discord reads AUTH_DISCORD_ID / AUTH_DISCORD_SECRET.
  // Both callbacks must be registered in each provider dashboard:
  //   http://localhost:3000/api/auth/callback/github
  //   http://localhost:3000/api/auth/callback/discord
  providers: [GitHub, Discord],
  trustHost: true,
});
