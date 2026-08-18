import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listEmails } from "@/lib/repository/email-store";

export default async function EmailsPage() {
  const session = await requireSession();
  if (!session) redirect("/sign-in");

  const emails = await listEmails(session.organizationId);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-500">Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Emails</h1>
          </div>
          <Link href="/emails/new" className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
            Create email
          </Link>
        </div>

        {emails.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <Mail className="mx-auto mb-3 text-zinc-300" />
            <div className="font-medium">No emails yet</div>
            <p className="mt-1 text-sm text-zinc-500">Create one to start building in the visual editor.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {emails.map(email => (
              <Link key={email.id} href={`/emails/${email.id}/builder`} className="block rounded-xl border bg-white p-5 shadow-sm hover:border-zinc-300">
                <div className="font-medium">{email.name}</div>
                <div className="mt-1 text-sm text-zinc-500">
                  {email.status === "draft" ? "Draft" : email.status} · Updated {new Date(email.updatedAt).toLocaleDateString()}
                </div>
                <div className="mt-4 text-sm font-medium underline">Open builder →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
