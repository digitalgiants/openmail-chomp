"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  subject?: string | null;
  status: string;
  createdAt: string;
  recipientCounts: Record<string, number>;
}

interface CampaignRecipient {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
}

interface CampaignDetail extends Campaign {
  recipients: CampaignRecipient[];
}

const statusColor: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  sending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-zinc-100 text-zinc-500",
  draft: "bg-zinc-100 text-zinc-500",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/campaigns", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setCampaigns(d.campaigns ?? []);
    } catch { setCampaigns([]); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/campaigns/${selectedId}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const summarize = (counts: Record<string, number>) => {
    const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([status, n]) => `${n} ${status}`);
    return parts.length ? parts.join(", ") : "No recipients";
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-500">AUDIENCE</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="mt-1 text-sm text-zinc-500">Send history for every email you've sent from this workspace.</p>
          </div>
          <button onClick={() => setShowCompose(true)} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
            + New Campaign
          </button>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border bg-white">
          {campaigns.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No campaigns sent yet. Send an email from the builder, or start one here.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Recipients</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map(c => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.subject && <div className="mt-0.5 text-xs text-zinc-500">{c.subject}</div>}
                    </td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusColor[c.status] ?? "bg-zinc-100 text-zinc-500"}`}>{c.status}</span></td>
                    <td className="px-5 py-3 text-zinc-500">{summarize(c.recipientCounts)}</td>
                    <td className="px-5 py-3 text-zinc-500">{new Date(c.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelectedId(null)}>
          <aside onClick={e => e.stopPropagation()} className="h-full w-full max-w-md overflow-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{detail?.name ?? "Campaign"}</h2><button onClick={() => setSelectedId(null)}><X size={18} /></button></div>
            {!detail ? <p className="mt-6 text-sm text-zinc-500">Loading…</p> : (
              <>
                {detail.subject && <p className="mt-2 text-sm text-zinc-500">{detail.subject}</p>}
                <div className="mt-6 space-y-1.5">
                  {detail.recipients.map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <span>{[r.firstName, r.lastName].filter(Boolean).join(" ") || r.email}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor[r.status] ?? "bg-zinc-100 text-zinc-500"}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {showCompose && <ComposeCampaign onClose={() => { setShowCompose(false); load(); }} />}
    </div>
  );
}

interface EmailOption { id: string; name: string; }
interface ComposeContact { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; }
interface ComposeList { id: string; name: string; memberCount: number; }

function ComposeCampaign({ onClose }: { onClose: () => void }) {
  const [emails, setEmails] = useState<EmailOption[]>([]);
  const [emailId, setEmailId] = useState("");
  const [contacts, setContacts] = useState<ComposeContact[]>([]);
  const [lists, setLists] = useState<ComposeList[]>([]);
  const [listMembers, setListMembers] = useState<Record<string, ComposeContact[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/emails", { cache: "no-store" }).then(r => r.ok ? r.json() : []).then(setEmails).catch(() => setEmails([]));
    fetch("/api/contacts", { cache: "no-store" }).then(r => r.ok ? r.json() : { contacts: [] }).then(d => setContacts(d.contacts ?? [])).catch(() => setContacts([]));
    fetch("/api/contact-lists", { cache: "no-store" }).then(r => r.ok ? r.json() : { lists: [] }).then(d => setLists(d.lists ?? [])).catch(() => setLists([]));
  }, []);

  const toggle = (email: string) => setSelected(s => { const next = new Set(s); next.has(email) ? next.delete(email) : next.add(email); return next; });
  const toggleList = async (listId: string) => {
    setSelectedLists(s => { const next = new Set(s); next.has(listId) ? next.delete(listId) : next.add(listId); return next; });
    if (!listMembers[listId]) {
      const r = await fetch(`/api/contact-lists/${listId}/members`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setListMembers(m => ({ ...m, [listId]: d.members ?? [] }));
    }
  };

  const send = async () => {
    if (!emailId) { setError("Choose an email to send."); return; }
    const extraEmails = extra.split(/[\n,]/).map(e => e.trim()).filter(Boolean);
    const listEmails = [...selectedLists].flatMap(id => (listMembers[id] ?? []).filter(c => c.status !== "unsubscribed").map(c => c.email));
    const recipientEmails = [...new Set([...selected, ...listEmails, ...extraEmails])];
    if (recipientEmails.length === 0) { setError("Add at least one recipient."); return; }
    setError(""); setStatus("sending");
    const r = await fetch(`/api/emails/${emailId}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientEmails }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Could not send."); setStatus("idle"); return; }
    setStatus("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">New Campaign</h2><button onClick={onClose}><X size={18} /></button></div>

        {status === "done" ? (
          <div className="mt-5">
            <p className="text-sm text-zinc-600">Campaign sent. Check the campaigns list for delivery results.</p>
            <button onClick={onClose} className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        ) : (
          <div className="mt-5">
            <label className="block text-sm font-medium">Email
              <select value={emailId} onChange={e => setEmailId(e.target.value)} className="mt-1.5 w-full rounded-lg border p-2.5 text-sm">
                <option value="">Choose an email…</option>
                {emails.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>

            {lists.length > 0 && <div className="mb-4 mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Lists</div>
              <div className="space-y-1 rounded-lg border p-2">
                {lists.map(l => <label key={l.id} className="flex items-center gap-2.5 rounded p-1.5 text-sm hover:bg-zinc-50">
                  <input type="checkbox" checked={selectedLists.has(l.id)} onChange={() => toggleList(l.id)} />
                  <span>{l.name}</span>
                  <span className="text-zinc-400">{l.memberCount} contact{l.memberCount === 1 ? "" : "s"}</span>
                </label>)}
              </div>
            </div>}

            {contacts.length > 0 && <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Contacts</div>
              <div className="max-h-40 space-y-1 overflow-auto rounded-lg border p-2">
                {contacts.map(c => {
                  const unsubscribed = c.status === "unsubscribed";
                  return <label key={c.id} className={`flex items-center gap-2.5 rounded p-1.5 text-sm ${unsubscribed ? "opacity-50" : "hover:bg-zinc-50"}`}>
                    <input type="checkbox" disabled={unsubscribed} checked={selected.has(c.email)} onChange={() => toggle(c.email)} />
                    <span>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</span>
                    {(c.firstName || c.lastName) && <span className="text-zinc-400">{c.email}</span>}
                    {unsubscribed && <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">Unsubscribed</span>}
                  </label>;
                })}
              </div>
            </div>}

            <label className="block text-sm font-medium">Other recipients<span className="ml-1 font-normal text-zinc-400">(comma or newline separated)</span>
              <textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="someone@example.com" className="mt-1.5 min-h-16 w-full rounded-lg border p-2.5 text-sm" />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button onClick={send} disabled={status === "sending"} className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{status === "sending" ? "Sending…" : "Send campaign"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
