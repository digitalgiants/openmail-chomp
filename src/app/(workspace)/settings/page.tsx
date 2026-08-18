import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Page } from "@/components/ui/page";
import { auth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth/session";
import { SettingsPanel } from "@/components/settings/settings-panel";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");

  const organization = await auth.api.getFullOrganization({ headers: await headers() });
  if (!organization) redirect("/dashboard");

  return (
    <Page title="Settings" description="Manage your workspace and team.">
      <SettingsPanel organization={organization} currentUserId={session.user.id} />
    </Page>
  );
}
