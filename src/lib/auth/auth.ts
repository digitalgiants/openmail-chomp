import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { magicLink } from "better-auth/plugins/magic-link";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as authSchema from "@/db/auth-schema";
import { sendInvitationEmail, sendMagicLinkEmail } from "./email";

function slugify(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  advanced: { database: { generateId: "uuid" } },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const organizationId = crypto.randomUUID();
          await db.insert(authSchema.organization).values({
            id: organizationId,
            name: `${user.name || user.email.split("@")[0]}'s Workspace`,
            slug: slugify(user.email),
            createdAt: new Date(),
          });
          await db.insert(authSchema.member).values({
            id: crypto.randomUUID(),
            organizationId,
            userId: user.id,
            role: "owner",
            createdAt: new Date(),
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: authSchema.member.organizationId })
            .from(authSchema.member)
            .where(eq(authSchema.member.userId, session.userId))
            .limit(1);
          if (!membership) return;
          return { data: { ...session, activeOrganizationId: membership.organizationId } };
        },
      },
    },
  },
  plugins: [
    organization({ creatorRole: "owner", sendInvitationEmail }),
    magicLink({ sendMagicLink: sendMagicLinkEmail }),
    nextCookies(),
  ],
});
