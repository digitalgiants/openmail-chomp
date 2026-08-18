"use client";
import { useEffect, useState } from "react";

interface Contact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const r = await fetch("/api/contacts", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setContacts(d.contacts ?? []);
    } catch {
      setContacts([]);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = contacts.filter(c => `${c.email} ${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const r = await fetch(editing ? `/api/contacts/${editing.id}` : "/api/contacts", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { setOpen(false); setEditing(null); load(); }
    else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Could not save contact."); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-500">AUDIENCE</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="mt-1 text-sm text-zinc-500">People you can send emails to.</p>
          </div>
          <button onClick={() => { setEditing(null); setError(""); setOpen(true); }} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
            + New Contact
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search contacts…" className="w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
          <div className="text-sm text-zinc-500">{filtered.length} contacts</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No contacts yet. Add one to start building your audience.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Added</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{c.email}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${c.status === "subscribed" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => { setEditing(c); setError(""); setOpen(true); }} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">Edit</button>
                      <button onClick={() => remove(c.id)} className="ml-2 rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editing ? "Edit Contact" : "New Contact"}</h2>
              <button type="button" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Email
                <input name="email" type="email" defaultValue={editing?.email ?? ""} className="mt-1 w-full rounded-lg border p-2.5" required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">First name
                  <input name="firstName" defaultValue={editing?.firstName ?? ""} className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
                <label className="block text-sm font-medium">Last name
                  <input name="lastName" defaultValue={editing?.lastName ?? ""} className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
              </div>
              <label className="block text-sm font-medium">Status
                <select name="status" defaultValue={editing?.status ?? "subscribed"} className="mt-1 w-full rounded-lg border p-2.5">
                  <option value="subscribed">Subscribed</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Save Contact</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
