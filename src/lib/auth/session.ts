import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const result = await getCurrentSession();
  if (!result?.session.activeOrganizationId) return null;
  return { user: result.user, session: result.session, organizationId: result.session.activeOrganizationId as string };
}
