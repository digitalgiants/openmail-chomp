"use client";
import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Trash2, X } from "lucide-react";

interface DomainRecord {
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status?: string;
  value: string;
  priority?: number;
}

interface Domain {
  id: string;
  domain: string;
  status: string;
  createdAt: string;
  verificationRecords?: { records?: DomainRecord[] } | null;
}

const statusColor: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  not_started: "bg-zinc-100 text-zinc-500",
  failure: "bg-red-50 text-red-700",
  temporary_failure: "bg-red-50 text-red-700",
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const selected = domains.find(d => d.id === selectedId) ?? null;

  const load = async () => {
    try {
      const r = await fetch("/api/domains", { cache: "no-store" });
      const d = r.ok ? await r.json() : {};
      setDomains(d.domains ?? []);
    } catch { setDomains([]); }
  };
  useEffect(() => { load(); }, []);

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAdding(true); setError("");
    const r = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: newDomain.trim() }) });
    setAdding(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Could not add domain."); return; }
    const row = await r.json();
    setNewDomain(""); setShowAdd(false); await load(); setSelectedId(row.id);
  };

  const refresh = async (id: string) => {
    setChecking(true);
    const r = await fetch(`/api/domains/${id}`, { cache: "no-store" });
    setChecking(false);
    if (r.ok) load();
  };

  const verify = async (id: string) => {
    setChecking(true);
    const r = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
    setChecking(false);
    if (r.ok) load(); else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Could not check verification."); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this domain? You'll need to add and re-verify it again to use it as a sending domain.")) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    load();
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-500">SYSTEM</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Domains</h1>
            <p className="mt-1 text-sm text-zinc-500">Verify a domain to send campaigns from your own address instead of a shared testing domain.</p>
          </div>
          <button onClick={() => { setError(""); setShowAdd(true); }} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">+ Add domain</button>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border bg-white">
          {domains.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No domains yet. Add one to send campaigns from your own address.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Added</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {domains.map(d => (
                  <tr key={d.id} onClick={() => setSelectedId(d.id)} className="cursor-pointer hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium">{d.domain}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusColor[d.status] ?? "bg-zinc-100 text-zinc-500"}`}>{d.status.replace(/_/g, " ")}</span></td>
                    <td className="px-5 py-3 text-zinc-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => remove(d.id)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
          Adding a domain here calls Resend's Domains API and mirrors what you'd otherwise do in the Resend dashboard. Once you add a domain, add the DNS records it gives you at your DNS provider, then click "Check verification" — DNS propagation can take anywhere from a few minutes to a few hours.
        </div>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelectedId(null)}>
          <aside onClick={e => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected?.domain ?? "Domain"}</h2>
                {selected && <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusColor[selected.status] ?? "bg-zinc-100 text-zinc-500"}`}>{selected.status.replace(/_/g, " ")}</span>}
              </div>
              <button onClick={() => setSelectedId(null)}><X size={18} /></button>
            </div>

            {selected && (
              <>
                <div className="mt-5 flex gap-2">
                  <button onClick={() => refresh(selected.id)} disabled={checking} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50"><RefreshCw size={13} /> Refresh status</button>
                  <button onClick={() => verify(selected.id)} disabled={checking} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check size={13} /> Check verification</button>
                </div>

                <div className="mt-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">DNS records to add</div>
                  <p className="mt-1 text-xs text-zinc-500">Add each of these at your DNS provider exactly as shown, then check verification above.</p>
                  <div className="mt-3 space-y-2">
                    {(selected.verificationRecords?.records ?? []).length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-zinc-400">No records returned yet — try refreshing status.</div>
                    ) : (selected.verificationRecords?.records ?? []).map((rec, i) => <RecordRow key={i} record={rec} />)}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setShowAdd(false)}>
          <form onSubmit={addDomain} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Add domain</h2><button type="button" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <label className="mt-4 block text-sm font-medium">Domain
              <input autoFocus value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="yourdomain.com" className="mt-1.5 w-full rounded-lg border p-2.5 text-sm" required />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button disabled={adding || !newDomain.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{adding ? "Adding…" : "Add domain"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RecordRow({ record }: { record: DomainRecord }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(record.value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div className="rounded-lg border p-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold">{record.type}</span>
          <span className="font-mono text-zinc-600">{record.name}</span>
        </div>
        {record.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor[record.status] ?? "bg-zinc-100 text-zinc-500"}`}>{record.status}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-zinc-50 px-2 py-1.5 font-mono text-zinc-700">{record.value}{record.priority !== undefined ? ` (priority ${record.priority})` : ""}</code>
        <button onClick={copy} title="Copy value" className="shrink-0 rounded-md border p-1.5 hover:bg-zinc-50">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
      </div>
    </div>
  );
}
