import type { NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/server/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import { env, features } from "@/env";

/**
 * Providers are registered only when their credentials exist, so a local
 * checkout without OAuth secrets still boots and shows the providers that are
 * actually usable rather than failing at import time.
 */
function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (features.githubAuth) {
    providers.push(
      GitHub({
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (features.googleAuth) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: { prompt: "consent", access_type: "offline", response_type: "code" },
        },
      }),
    );
  }

  if (features.email) {
    providers.push(
      Resend({
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM,
      }),
    );
  }

  return providers;
}

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }) as Adapter,

  providers: buildProviders(),

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh at most daily
  },

  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
    verifyRequest: "/sign-in/verify",
    newUser: "/onboarding",
  },

  callbacks: {
    /**
     * Copy the database user id onto the session so every downstream query can
     * scope by it without a second lookup.
     */
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },

    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },

  trustHost: true,
  secret: env.AUTH_SECRET,
} satisfies NextAuthConfig;
