"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { authClient } from "@/lib/auth/client";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export function OrgSwitcher() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeId = session?.session.activeOrganizationId as string | undefined;
  const active = organizations?.find(o => o.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const switchTo = async (organizationId: string) => {
    if (organizationId === activeId) { setOpen(false); return; }
    setSwitching(organizationId);
    const { error } = await authClient.organization.setActive({ organizationId });
    setSwitching(null);
    setOpen(false);
    // Server components (sidebar links, every page's requireSession call)
    // read the org id from the session cookie, which setActive just
    // rewrote -- a full refresh is needed for them to see it. Landing on
    // /dashboard also avoids leaving an org-scoped page (e.g. a builder
    // tab for an email that belongs to the org we just left) open.
    if (!error) router.push("/dashboard");
    router.refresh();
  };

  return (
    <div ref={menuRef} className="relative px-3 pb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-left text-sm hover:bg-zinc-50"
      >
        <span className="truncate font-medium">{active?.name ?? "Loading…"}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-20 mt-1 rounded-lg border bg-white py-1 shadow-lg">
          {(organizations ?? []).map(org => (
            <button
              key={org.id}
              onClick={() => switchTo(org.id)}
              disabled={switching !== null}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              <span className="truncate">{org.name}</span>
              {org.id === activeId ? <Check size={14} className="shrink-0 text-zinc-500" /> : switching === org.id ? <span className="text-[10px] text-zinc-400">Switching…</span> : null}
            </button>
          ))}
          <div className="my-1 border-t" />
          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <Plus size={14} /> New workspace
          </button>
        </div>
      )}

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreated={() => { router.push("/dashboard"); router.refresh(); }} />}
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await authClient.organization.create({ name: name.trim(), slug: slugify(name) });
    setSaving(false);
    if (error) { setError(error.message ?? "Could not create workspace."); return; }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">New workspace</h2>
        <label className="mt-4 block text-sm font-medium">
          Name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder="Acme Marketing"
            className="mt-1.5 w-full rounded-lg border p-2.5 text-sm"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button onClick={create} disabled={saving || !name.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}
