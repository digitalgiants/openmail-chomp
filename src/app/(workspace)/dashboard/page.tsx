import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns, contacts, emails } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { listEmails } from "@/lib/repository/email-store";

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");

  const organizationId = session.organizationId;
  const [[{ value: draftCount }], [{ value: contactCount }], [{ value: sentCount }], recentEmails] = await Promise.all([
    db.select({ value: count() }).from(emails).where(eq(emails.organizationId, organizationId)),
    db.select({ value: count() }).from(contacts).where(eq(contacts.organizationId, organizationId)),
    db.select({ value: count() }).from(campaigns).where(eq(campaigns.organizationId, organizationId)),
    listEmails(organizationId),
  ]);
  const mostRecentEmail = recentEmails[0];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-500">Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-zinc-500">Create, design, and deliver beautiful emails.</p>
          </div>
          <Link href="/emails/new" className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
            Create email
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-zinc-500">Emails</p>
            <p className="mt-2 text-3xl font-semibold">{draftCount}</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-zinc-500">Contacts</p>
            <p className="mt-2 text-3xl font-semibold">{contactCount}</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-zinc-500">Campaigns</p>
            <p className="mt-2 text-3xl font-semibold">{sentCount}</p>
          </div>
        </div>

        {mostRecentEmail ? (
          <div className="mt-8 rounded-xl border bg-white p-6">
            <h2 className="font-semibold">Continue where you left off</h2>
            <p className="mt-1 text-sm text-zinc-500">{mostRecentEmail.name}</p>
            <Link href={`/emails/${mostRecentEmail.id}/builder`} className="mt-4 inline-block text-sm font-medium underline">
              Open the builder →
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border bg-white p-6">
            <h2 className="font-semibold">Build your first email</h2>
            <p className="mt-1 text-sm text-zinc-500">Structured document → visual builder → preview → send.</p>
            <Link href="/emails/new" className="mt-4 inline-block text-sm font-medium underline">
              Create an email →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
