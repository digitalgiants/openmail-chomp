import { getContactById } from "@/lib/repository/contact-store";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const { contact: contactId } = await searchParams;
  const contact = contactId ? await getContactById(contactId) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-xl font-bold tracking-tight">◈ VaultFoundry</div>
        {!contact ? (
          <p className="mt-4 text-sm text-zinc-600">This unsubscribe link isn't valid.</p>
        ) : contact.status === "unsubscribed" ? (
          <p className="mt-4 text-sm text-zinc-600">{contact.email} is already unsubscribed.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-zinc-600">Unsubscribe <strong>{contact.email}</strong> from future emails?</p>
            <UnsubscribeConfirm contactId={contact.id} />
          </>
        )}
      </div>
    </div>
  );
}
