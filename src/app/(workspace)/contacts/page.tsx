"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, Settings2, Trash2, UserPlus, X } from "lucide-react";

interface Contact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  createdAt: string;
}

interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
}

interface CustomField {
  id: string;
  name: string;
  fieldType: string;
}

const fieldInputType: Record<string, string> = { text: "text", number: "number", date: "date", url: "url" };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listMembers, setListMembers] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [error, setError] = useState("");

  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showAddToList, setShowAddToList] = useState(false);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [addQuery, setAddQuery] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadContacts = async () => {
    try {
      const r = await fetch("/api/contacts", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setContacts(d.contacts ?? []);
    } catch { setContacts([]); }
  };
  const loadLists = async () => {
    try {
      const r = await fetch("/api/contact-lists", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setLists(d.lists ?? []);
    } catch { setLists([]); }
  };
  const loadListMembers = async (listId: string) => {
    setLoadingMembers(true);
    try {
      const r = await fetch(`/api/contact-lists/${listId}/members`, { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setListMembers(d.members ?? []);
    } catch { setListMembers([]); }
    finally { setLoadingMembers(false); }
  };
  const loadFields = async () => {
    try {
      const r = await fetch("/api/contact-fields", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setFields(d.fields ?? []);
    } catch { setFields([]); }
  };

  useEffect(() => { loadContacts(); loadLists(); loadFields(); }, []);
  useEffect(() => {
    if (!activeListId) { setListMembers([]); return; }
    // Clear immediately rather than waiting for the fetch to resolve --
    // otherwise, for a moment, listMembers still holds whichever list was
    // active before, so "Add contacts" on the newly active list computes
    // against the wrong list's members and can wrongly report everyone as
    // already added.
    setListMembers([]);
    loadListMembers(activeListId);
  }, [activeListId]);

  const activeList = lists.find(l => l.id === activeListId) ?? null;
  const source = activeListId ? listMembers : contacts;
  const filtered = source.filter(c => `${c.email} ${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  async function openEdit(c: Contact) {
    setEditing(c); setError(""); setFieldValues({}); setOpen(true);
    try {
      const r = await fetch(`/api/contacts/${c.id}/fields`, { cache: "no-store" });
      const d = r.ok ? await r.json() : { values: [] };
      setFieldValues(Object.fromEntries((d.values ?? []).map((v: { fieldId: string; value: string | null }) => [v.fieldId, v.value ?? ""])));
    } catch { /* leave field inputs blank if this fails -- the contact itself still loaded fine */ }
  }

  function openNew() {
    setEditing(null); setError(""); setFieldValues({}); setOpen(true);
  }

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
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Could not save contact."); return; }
    const contact = await r.json();
    if (fields.length > 0) {
      await fetch(`/api/contacts/${contact.id}/fields`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: fieldValues }) });
    }
    setOpen(false); setEditing(null); loadContacts(); if (activeListId) loadListMembers(activeListId);
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact? This removes them from all lists too.")) return;
    const r = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error ?? "Could not delete contact."); return; }
    loadContacts(); loadLists(); if (activeListId) loadListMembers(activeListId);
  }

  async function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    const r = await fetch("/api/contact-fields", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newFieldName.trim(), fieldType: newFieldType }) });
    if (r.ok) { setNewFieldName(""); setNewFieldType("text"); loadFields(); }
  }

  async function removeField(id: string) {
    if (!confirm("Delete this field? Its values on every contact will be deleted too.")) return;
    await fetch(`/api/contact-fields/${id}`, { method: "DELETE" });
    loadFields();
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const r = await fetch("/api/contact-lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newListName.trim() }) });
    if (r.ok) { const list = await r.json(); setNewListName(""); setShowNewList(false); await loadLists(); setActiveListId(list.id); }
  }

  async function renameList(id: string) {
    if (!renameValue.trim()) { setRenamingListId(null); return; }
    await fetch(`/api/contact-lists/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: renameValue.trim() }) });
    setRenamingListId(null); loadLists();
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list? Contacts themselves won't be deleted.")) return;
    await fetch(`/api/contact-lists/${id}`, { method: "DELETE" });
    if (activeListId === id) setActiveListId(null);
    loadLists();
  }

  async function removeFromList(contactId: string) {
    if (!activeListId) return;
    await fetch(`/api/contact-lists/${activeListId}/members/${contactId}`, { method: "DELETE" });
    loadListMembers(activeListId); loadLists();
  }

  async function addSelectedToList() {
    if (!activeListId || addSelection.size === 0) return;
    await fetch(`/api/contact-lists/${activeListId}/members`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactIds: [...addSelection] }) });
    setAddSelection(new Set()); setShowAddToList(false);
    loadListMembers(activeListId); loadLists();
  }

  const toggleAddSelection = (id: string) => setAddSelection(s => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const notInActiveList = contacts.filter(c => !listMembers.some(m => m.id === c.id));
  const addCandidates = notInActiveList.filter(c => `${c.email} ${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(addQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-500">AUDIENCE</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="mt-1 text-sm text-zinc-500">People you can send emails to.</p>
          </div>
          {!activeListId ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFields(true)} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold hover:bg-zinc-50"><Settings2 size={15} /> Custom fields</button>
              <button onClick={openNew} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
                + New Contact
              </button>
            </div>
          ) : (
            <button onClick={() => { setAddQuery(""); setAddSelection(new Set()); setShowAddToList(true); }} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
              <UserPlus size={15} /> Add contacts
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-lg border bg-white p-1.5">
          <button onClick={() => setActiveListId(null)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${!activeListId ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>All Contacts ({contacts.length})</button>
          {lists.map(l => renamingListId === l.id ? (
            <input key={l.id} autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => renameList(l.id)} onKeyDown={e => e.key === "Enter" && renameList(l.id)} className="rounded-md border px-2 py-1 text-xs" />
          ) : (
            <button key={l.id} onClick={() => setActiveListId(l.id)} onDoubleClick={() => { setRenamingListId(l.id); setRenameValue(l.name); }} title="Double-click to rename" className={`rounded-md px-3 py-1.5 text-xs font-medium ${activeListId === l.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>{l.name} ({l.memberCount})</button>
          ))}
          <button onClick={() => setShowNewList(true)} title="New list" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900"><Plus size={15} /></button>
        </div>

        {activeList && (
          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
            <span>Viewing list: <strong className="text-zinc-700">{activeList.name}</strong></span>
            <button onClick={() => { setRenamingListId(activeList.id); setRenameValue(activeList.name); }} className="flex items-center gap-1 hover:text-zinc-900"><Pencil size={12} /> Rename</button>
            <button onClick={() => deleteList(activeList.id)} className="flex items-center gap-1 hover:text-red-600"><Trash2 size={12} /> Delete list</button>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search contacts…" className="w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
          <div className="text-sm text-zinc-500">{filtered.length} contacts</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">{activeListId ? "No contacts in this list yet." : "No contacts yet. Add one to start building your audience."}</div>
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
                      {activeListId ? (
                        <button onClick={() => removeFromList(c.id)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Remove from list</button>
                      ) : (
                        <>
                          <button onClick={() => openEdit(c)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">Edit</button>
                          <button onClick={() => remove(c.id)} className="ml-2 rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                        </>
                      )}
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
              {fields.length > 0 && <>
                <div className="border-t pt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Custom fields</div>
                {fields.map(f => (
                  <label key={f.id} className="block text-sm font-medium">{f.name}
                    <input
                      type={fieldInputType[f.fieldType] ?? "text"}
                      value={fieldValues[f.id] ?? ""}
                      onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border p-2.5"
                    />
                  </label>
                ))}
              </>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Save Contact</button>
            </div>
          </form>
        </div>
      )}

      {showNewList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setShowNewList(false)}>
          <form onSubmit={createList} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">New List</h2><button type="button" onClick={() => setShowNewList(false)}><X size={18} /></button></div>
            <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g. Newsletter subscribers" className="mt-4 w-full rounded-lg border p-2.5 text-sm" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewList(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Create</button>
            </div>
          </form>
        </div>
      )}

      {showFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setShowFields(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Custom fields</h2><button onClick={() => setShowFields(false)}><X size={18} /></button></div>
            <p className="mt-1 text-xs text-zinc-500">Extra properties you can set per contact, e.g. company or plan tier.</p>

            <div className="mt-4 space-y-1.5">
              {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-zinc-400">No custom fields yet.</div>
              ) : fields.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{f.fieldType}</span>
                    <button onClick={() => removeField(f.id)} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={addField} className="mt-4 flex items-center gap-2 border-t pt-4">
              <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Field name" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
              <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} className="rounded-lg border p-2 text-sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="url">URL</option>
              </select>
              <button disabled={!newFieldName.trim()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Plus size={14} /> Add</button>
            </form>
          </div>
        </div>
      )}

      {showAddToList && activeListId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setShowAddToList(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Add contacts to {activeList?.name}</h2><button onClick={() => setShowAddToList(false)}><X size={18} /></button></div>
            <input autoFocus value={addQuery} onChange={e => setAddQuery(e.target.value)} placeholder="Search contacts…" className="mt-4 w-full rounded-lg border p-2.5 text-sm" />
            <div className="mt-3 max-h-72 space-y-1 overflow-auto rounded-lg border p-2">
              {loadingMembers ? (
                <div className="p-4 text-center text-sm text-zinc-500">Loading…</div>
              ) : addCandidates.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">{notInActiveList.length === 0 ? "All contacts are already in this list." : "No contacts match your search."}</div>
              ) : addCandidates.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 rounded p-1.5 text-sm hover:bg-zinc-50">
                  <input type="checkbox" checked={addSelection.has(c.id)} onChange={() => toggleAddSelection(c.id)} />
                  <span>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</span>
                  {(c.firstName || c.lastName) && <span className="text-zinc-400">{c.email}</span>}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAddToList(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={addSelectedToList} disabled={addSelection.size === 0} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add {addSelection.size || ""}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
