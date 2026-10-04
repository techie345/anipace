import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Discord reads AUTH_DISCORD_ID / AUTH_DISCORD_SECRET.
  // Callback must be registered in the Discord provider dashboard:
  //   http://localhost:3000/api/auth/callback/discord
  providers: [Discord],
  trustHost: true,
});
