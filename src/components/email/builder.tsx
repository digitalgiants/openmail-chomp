"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, Tablet, Undo2, Redo2, Save, Eye, Code2, Settings2, Trash2, Copy, GripVertical, ChevronUp, ChevronDown, Plus, X, LayoutTemplate, MousePointer2, Blocks, LibraryBig, Send as SendIcon, History as HistoryIcon } from "lucide-react";
import { componentRegistry, builderComponents, groupColumnsIntoRows, type EmailComponent, type EmailDocument } from "@/lib/email";
import { AssetPicker } from "./asset-picker";
import { LinkPicker } from "./link-picker";
import type { AssetRecord } from "@/lib/assets/types";

function uid(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

// Custom @font-face/Google Fonts aren't offered here on purpose -- Outlook
// desktop (still a large share of business inboxes) doesn't support
// @font-face at all, so a "custom font" picker would silently fail for a
// chunk of recipients with no visible warning. These are the standard
// web-safe stacks every major ESP sticks to for exactly that reason.
const FONT_STACKS: { label: string; value: string }[] = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', Times, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Palatino", value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
];

type Device = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<Device, number> = { desktop: 600, tablet: 480, mobile: 360 };

function findNode(nodes: EmailComponent[], id: string | null): EmailComponent | undefined {
  if (!id) return undefined;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children && findNode(node.children, id);
    if (found) return found;
  }
}

function mapNodes(nodes: EmailComponent[], id: string, fn: (node: EmailComponent) => EmailComponent): EmailComponent[] {
  return nodes.map(node => node.id === id ? fn(node) : { ...node, children: node.children ? mapNodes(node.children, id, fn) : node.children });
}

// Direct parent id of a node, wherever it lives in the tree. Root-level
// nodes have no parent (null); undefined means the id wasn't found at all.
function findParentId(nodes: EmailComponent[], id: string, parentId: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    if (node.children) {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// Nearest ancestor of the given type, walking up from id (id's own node
// counts as its own ancestor if it already matches).
function findAncestorOfType(nodes: EmailComponent[], id: string, type: EmailComponent["type"]): EmailComponent | null {
  let currentId: string | null | undefined = id;
  while (currentId) {
    const node = findNode(nodes, currentId);
    if (node?.type === type) return node;
    currentId = findParentId(nodes, currentId);
  }
  return null;
}

function removeNode(nodes: EmailComponent[], id: string): { nodes: EmailComponent[]; removed?: EmailComponent } {
  let removed: EmailComponent | undefined;
  const next: EmailComponent[] = [];
  for (const node of nodes) {
    if (node.id === id) { removed = node; continue; }
    if (node.children) {
      const result = removeNode(node.children, id);
      if (result.removed) removed = result.removed;
      next.push({ ...node, children: result.nodes });
    } else next.push(node);
  }
  return { nodes: next, removed };
}

function duplicateNode(nodes: EmailComponent[], id: string): { nodes: EmailComponent[]; copyId?: string } {
  let copyId: string | undefined;
  const next: EmailComponent[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      const clone = structuredClone(node) as EmailComponent;
      const rekey = (n: EmailComponent) => { n.id = uid(n.type); n.children?.forEach(rekey); };
      rekey(clone); copyId = clone.id;
      next.push(node, clone);
    } else if (node.children) {
      const result = duplicateNode(node.children, id);
      if (result.copyId) copyId = result.copyId;
      next.push({ ...node, children: result.nodes });
    } else next.push(node);
  }
  return { nodes: next, copyId };
}

// Moves a node up/down within its own parent's children, wherever it
// lives in the tree (root, inside a column, nested content, etc.) —
// recurses into descendants until it finds the level the node is actually
// at, rather than only handling root-level reordering.
function moveNode(nodes: EmailComponent[], id: string, delta: -1 | 1): EmailComponent[] {
  const index = nodes.findIndex(n => n.id === id);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes]; [next[index], next[target]] = [next[target], next[index]]; return next;
  }
  return nodes.map(n => n.children ? { ...n, children: moveNode(n.children, id, delta) } : n);
}

function makeSection(id: string): EmailComponent {
  return {
    id, type: "section", props: { backgroundColor: "#ffffff", paddingTop: "24px", paddingBottom: "24px" },
    children: [{ id: uid("column"), type: "column", props: { width: "100%" }, children: [] }]
  };
}

function ComponentVisual({ node, selectedId, onSelect }: { node: EmailComponent; selectedId: string | null; onSelect: (id: string) => void }) {
  const p = node.props ?? {};
  const selected = selectedId === node.id;
  const wrap = (content: React.ReactNode) => <div onClick={e => { e.stopPropagation(); onSelect(node.id); }} className={`group relative cursor-pointer ${selected ? "outline outline-2 outline-offset-2 outline-zinc-900" : "hover:outline hover:outline-1 hover:outline-zinc-300"}`}>{selected && <div className="absolute -top-6 left-0 z-20 rounded-t bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">{componentRegistry[node.type].label}</div>}{content}</div>;
  switch (node.type) {
    case "heading": return wrap(<h1 className="text-3xl font-bold tracking-tight" style={node.styles}>{String(p.content ?? "Your headline")}</h1>);
    case "text": return wrap(<p className="whitespace-pre-wrap text-base leading-7 text-zinc-600" style={node.styles}>{String(p.content ?? "Start writing your email…")}</p>);
    case "button": return wrap(<div className="py-2"><span className="inline-block rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white" style={node.styles}>{String(p.text ?? "Learn More")}</span></div>);
    case "image": return wrap(p.assetUrl ? <img src={String(p.assetUrl)} alt={String(p.alt ?? "")} className="max-h-96 w-full object-contain" style={node.styles} /> : <div className="flex h-40 items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400">Choose an image</div>);
    case "divider": return wrap(<hr className="my-2 border-zinc-200" />);
    case "spacer": return wrap(<div style={{ height: String(p.height ?? "24px") }} />);
    case "html": return wrap(<div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-xs text-zinc-500">Custom HTML block</div>);
    case "section": return wrap(<div style={{ backgroundColor: String(p.backgroundColor ?? "#ffffff"), paddingLeft: "24px", paddingRight: "24px" }}>{groupColumnsIntoRows(node.children ?? []).map((row, i, rows) => <div key={row[0]?.id ?? i} className="flex flex-wrap" style={{ paddingTop: i === 0 ? String(p.paddingTop ?? "24px") : undefined, paddingBottom: i === rows.length - 1 ? String(p.paddingBottom ?? "24px") : undefined }}>{row.map(child => <div key={child.id} style={{ width: child.props?.width ? String(child.props.width) : undefined, minWidth: 0, flex: child.props?.width ? "0 0 auto" : "1 1 0%" }}><ComponentVisual node={child} selectedId={selectedId} onSelect={onSelect} /></div>)}</div>)}</div>);
    case "column": return wrap(node.children?.length ? <div className="space-y-4">{node.children.map(child => <ComponentVisual key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}</div> : <div className="flex h-16 items-center justify-center rounded border border-dashed border-zinc-200 text-xs text-zinc-400">Empty column — select it, then add a component</div>);
    case "group":
    case "hero":
    case "header":
    case "footer":
    case "conditional": return wrap(<div className="space-y-4">{node.children?.map(child => <ComponentVisual key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}</div>);
    default: return wrap(<div className="rounded border border-dashed p-3 text-sm text-zinc-500">{node.type}</div>);
  }
}

export function Builder({ initialDocument, emailId }: { initialDocument: EmailDocument; emailId?: string }) {
  const [document, setDocument] = useState(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [library, setLibrary] = useState<"blocks" | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<EmailDocument[]>([]);
  const [future, setFuture] = useState<EmailDocument[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const dragId = useRef<string | null>(null);

  const selected = useMemo(() => findNode(document.children, selectedId), [document, selectedId]);

  const commit = useCallback((next: EmailDocument) => {
    setHistory(h => [...h.slice(-39), document]);
    setFuture([]);
    setDocument(next);
    setSaveState("unsaved");
  }, [document]);

  const updateNode = (key: string, value: unknown) => {
    if (!selectedId) return;
    commit({ ...document, children: mapNodes(document.children, selectedId, n => ({ ...n, props: { ...(n.props ?? {}), [key]: value } })) });
  };

  // Merges multiple prop changes into a single commit. Calling updateNode
  // several times in a row within one handler doesn't work for this: commit
  // is memoized off the current `document` closure, not a functional state
  // updater, so each call in the same synchronous handler overwrites the
  // previous one's change instead of merging with it.
  const updateNodeProps = (props: Record<string, unknown>) => {
    if (!selectedId) return;
    commit({ ...document, children: mapNodes(document.children, selectedId, n => ({ ...n, props: { ...(n.props ?? {}), ...props } })) });
  };

  const updateStyle = (key: string, value: string) => {
    if (!selectedId) return;
    commit({ ...document, children: mapNodes(document.children, selectedId, n => {
      // An empty value (e.g. picking "Default" in a select) removes the
      // override entirely rather than baking in an empty CSS declaration
      // like "font-family:;" -- letting it actually fall back to the
      // document-level default instead of just looking like it did.
      const styles = { ...(n.styles ?? {}) };
      if (value) styles[key] = value; else delete styles[key];
      return { ...n, styles };
    }) });
  };

  const saveAsTemplate = async () => {
    const name = window.prompt("Template name", document.metadata.name || "New Template");
    if (!name) return;
    const description = window.prompt("Short description (optional)", "Reusable email design") || undefined;
    const res = await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, document }) });
    if (res.ok) window.alert("Template saved to your library."); else window.alert("Could not save template.");
  };

  const saveAsBlock = async () => {
    if (!selected) { window.alert("Select a component first."); return; }
    const name = window.prompt("Block name", componentRegistry[selected.type].label);
    if (!name) return;
    const description = window.prompt("Short description (optional)", componentRegistry[selected.type].description) || undefined;
    const component = structuredClone(selected) as EmailComponent;
    const res = await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, category: selected.type, component }) });
    if (res.ok) window.alert("Block saved to your library."); else window.alert("Could not save block.");
  };

  const insertBlock = async (id: string) => {
    const res = await fetch(`/api/blocks/${id}`); if (!res.ok) return;
    const data = await res.json(); const clone = structuredClone(data.component) as EmailComponent;
    const rekey = (n: EmailComponent) => { n.id = uid(n.type); n.meta = { ...(n.meta ?? {}), sourceBlockId: data.id, sourceBlockVersion: data.version }; n.children?.forEach(rekey); };
    rekey(clone);
    commit({ ...document, children: [...document.children, clone] });
    setSelectedId(clone.id); setLibrary(null);
  };

  const add = (type: EmailComponent["type"]) => {
    const node = type === "section" ? makeSection(uid("section")) : componentRegistry[type].create(uid(type));
    // Sections always live at the document root. Anything else: if a
    // column (or something inside one) is selected, add into that column
    // instead of the root — otherwise fall back to the root, same as before.
    if (type !== "section" && selectedId) {
      const column = findAncestorOfType(document.children, selectedId, "column");
      if (column) {
        commit({ ...document, children: mapNodes(document.children, column.id, n => ({ ...n, children: [...(n.children ?? []), node] })) });
        setSelectedId(node.id);
        return;
      }
    }
    commit({ ...document, children: [...document.children, node] }); setSelectedId(node.id);
  };

  const addColumn = () => {
    if (!selected || selected.type !== "section") return;
    const rows = groupColumnsIntoRows(selected.children ?? []);
    if (rows.length === 0) return;
    const lastRow = rows[rows.length - 1];
    if (lastRow.length >= 3) return;
    const width = `${100 / (lastRow.length + 1)}%`;
    const updatedLastRow = [...lastRow.map(c => ({ ...c, props: { ...(c.props ?? {}), width } })), { id: uid("column"), type: "column" as const, props: { width }, children: [] }];
    const children = [...rows.slice(0, -1).flat(), ...updatedLastRow];
    commit({ ...document, children: mapNodes(document.children, selected.id, n => ({ ...n, children })) });
  };

  const addRow = () => {
    if (!selected || selected.type !== "section") return;
    const newColumn: EmailComponent = { id: uid("column"), type: "column", props: { width: "100%" }, children: [] };
    const children = [...(selected.children ?? []), newColumn];
    commit({ ...document, children: mapNodes(document.children, selected.id, n => ({ ...n, children })) });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const result = removeNode(document.children, selectedId);
    if (!result.removed) return;
    commit({ ...document, children: result.nodes }); setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const result = duplicateNode(document.children, selectedId);
    commit({ ...document, children: result.nodes }); if (result.copyId) setSelectedId(result.copyId);
  };

  const undo = () => { const previous = history.at(-1); if (!previous) return; setHistory(h => h.slice(0, -1)); setFuture(f => [document, ...f]); setDocument(previous); setSaveState("unsaved"); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture(f => f.slice(1)); setHistory(h => [...h, document]); setDocument(next); setSaveState("unsaved"); };

  // Restoring a version already persisted the change server-side (see
  // restoreEmailVersion), so this bypasses commit()'s autosave trigger --
  // otherwise the very next debounced PATCH would just write back the
  // same document that was already saved.
  const restoreVersion = (restoredDocument: EmailDocument) => {
    setHistory(h => [...h.slice(-39), document]);
    setFuture([]);
    setDocument(restoredDocument);
    setSaveState("saved");
    setShowHistory(false);
  };

  useEffect(() => {
    if (!emailId || saveState === "saved") return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try { const res = await fetch(`/api/emails/${emailId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ document, name: document.metadata.name, subject: document.metadata.subject, previewText: document.metadata.previewText }) }); if (!res.ok) throw new Error(); setSaveState("saved"); } catch { setSaveState("unsaved"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [document, emailId, saveState]);

  const onDrop = async (targetId: string | null, event: React.DragEvent) => {
    event.preventDefault();
    const blockId = event.dataTransfer.getData("application/x-vaultfoundry-block");
    if (blockId) {
      const res = await fetch(`/api/blocks/${blockId}`); if (!res.ok) return;
      const data = await res.json(); const clone = structuredClone(data.component) as EmailComponent;
      const rekey = (n: EmailComponent) => { n.id = uid(n.type); n.meta = { ...(n.meta ?? {}), sourceBlockId: data.id, sourceBlockVersion: data.version }; n.children?.forEach(rekey); };
      rekey(clone);
      const next = [...document.children];
      if (!targetId) next.push(clone); else { const idx = next.findIndex(n => n.id === targetId); idx < 0 ? next.push(clone) : next.splice(idx, 0, clone); }
      commit({ ...document, children: next }); setSelectedId(clone.id); setLibrary(null);
      return;
    }
    const sourceId = dragId.current; dragId.current = null;
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = document.children.findIndex(n => n.id === sourceId);
    const targetIndex = document.children.findIndex(n => n.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...document.children]; const [item] = next.splice(sourceIndex, 1); next.splice(next.findIndex(n => n.id === targetId), 0, item);
    commit({ ...document, children: next });
  };

  return <div className="flex h-screen flex-col bg-zinc-100">
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4">
      <div className="flex items-center gap-3"><a href="/emails" className="text-sm font-bold tracking-tight">VaultFoundry</a><span className="text-zinc-300">/</span><div><div className="text-sm font-semibold">{document.metadata.name || "Untitled Email"}</div><div className="text-[11px] text-zinc-500">{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : "Saved"}</div></div></div>
      <div className="flex items-center gap-1">
        <button title="Undo" disabled={!history.length} onClick={undo} className="rounded-md p-2 hover:bg-zinc-100 disabled:opacity-30"><Undo2 size={17}/></button>
        <button title="Redo" disabled={!future.length} onClick={redo} className="rounded-md p-2 hover:bg-zinc-100 disabled:opacity-30"><Redo2 size={17}/></button>
        <div className="mx-2 h-6 w-px bg-zinc-200" />
        <button onClick={() => setShowPreview(v => !v)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${showPreview ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}><Eye size={16}/> Preview</button>
        <button onClick={() => setShowCode(v => !v)} className={`rounded-md p-2 ${showCode ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`} title="HTML"><Code2 size={17}/></button>
        <button onClick={() => setShowSettings(v => !v)} className="rounded-md p-2 hover:bg-zinc-100" title="Email settings"><Settings2 size={17}/></button>
        {emailId && <button onClick={() => setShowHistory(true)} className="rounded-md p-2 hover:bg-zinc-100" title="Version history"><HistoryIcon size={17}/></button>}
        <button onClick={saveAsTemplate} className="ml-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><LayoutTemplate size={15}/> Save template</button>
        <button onClick={saveAsBlock} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><Blocks size={15}/> Save block</button>
        <button onClick={() => setLibrary("blocks")} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><LibraryBig size={15}/> Library</button>
        <button onClick={() => setSaveState("unsaved")} className="ml-1 flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"><Save size={15}/> Save</button>
        {emailId && <button onClick={() => setShowSend(true)} className="ml-1 flex items-center gap-2 rounded-md border border-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-50"><SendIcon size={15}/> Send</button>}
      </div>
    </header>

    {showPreview ? <PreviewPane document={document} device={device} setDevice={setDevice} showCode={showCode} /> : <div className="flex min-h-0 flex-1">
      <aside className="w-60 shrink-0 overflow-auto border-r bg-white p-4"><div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Content</div><div className="grid grid-cols-2 gap-2">{builderComponents.map(def => <button key={def.type} onClick={() => add(def.type)} className="rounded-lg border border-zinc-200 p-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50"><div className="text-lg">{def.icon}</div><div className="mt-1 text-xs font-semibold">{def.label}</div><div className="text-[10px] leading-4 text-zinc-500">{def.description}</div></button>)}</div><div className="mt-7 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500"><div className="font-semibold text-zinc-700">Tip</div> Select a column, then click a component here to add it there. Select a section for row/column options. Use the up/down arrows in the inspector to reorder anything, anywhere.</div></aside>
      <main className="min-w-0 flex-1 overflow-auto bg-zinc-100 p-8"><div className="mx-auto max-w-[760px]">
        <div className="mb-4 flex items-center justify-between"><div className="text-xs text-zinc-500">Email canvas</div><div className="flex items-center gap-1 rounded-lg border bg-white p-1"><DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={14}/></DeviceButton><DeviceButton active={device === "tablet"} onClick={() => setDevice("tablet")}><Tablet size={14}/></DeviceButton><DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={14}/></DeviceButton></div></div>
        <div className="mx-auto rounded-xl bg-white p-5 shadow-sm transition-all" style={{ width: deviceWidths[device] + 40 }} onClick={() => setSelectedId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(null,e)}>
          {document.children.length === 0 ? <div onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(null,e)} className="flex h-96 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center"><MousePointer2 className="mb-3 text-zinc-300"/><div className="text-sm font-medium">Start building your email</div><div className="mt-1 max-w-xs text-xs text-zinc-500">Add a section, text, image, button, or other component from the left.</div></div> : <div className="mx-auto" style={{ width: deviceWidths[device] }}>
            {document.children.map(node => <div key={node.id} draggable onDragStart={() => { dragId.current = node.id; }} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(node.id, e)} className="relative mb-2"><div className="absolute -left-8 top-2 opacity-0 transition group-hover:opacity-100"><GripVertical size={16}/></div><ComponentVisual node={node} selectedId={selectedId} onSelect={setSelectedId}/></div>)}
          </div>}
        </div>
      </div></main>
      {showSettings ? <SettingsPanel document={document} commit={commit} onClose={() => setShowSettings(false)} /> : <Inspector selected={selected} updateNode={updateNode} updateNodeProps={updateNodeProps} updateStyle={updateStyle} addColumn={addColumn} addRow={addRow} duplicate={duplicateSelected} remove={deleteSelected} moveUp={() => selectedId && commit({ ...document, children: moveNode(document.children, selectedId, -1) })} moveDown={() => selectedId && commit({ ...document, children: moveNode(document.children, selectedId, 1) })} />}
    </div>}
    {library === "blocks" && <BlockLibrary onClose={() => setLibrary(null)} onInsert={insertBlock} />}
    {showSend && emailId && <SendModal emailId={emailId} onClose={() => setShowSend(false)} />}
    {showHistory && emailId && <HistoryPanel emailId={emailId} onClose={() => setShowHistory(false)} onRestore={restoreVersion} />}
  </div>;
}

function BlockLibrary({ onClose, onInsert }: { onClose: () => void; onInsert: (id: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; name: string; description?: string; category?: string; version: number; component: EmailComponent }>>([]);
  const [q, setQ] = useState(""); const [category, setCategory] = useState("All");
  useEffect(() => { fetch("/api/blocks").then(r => r.ok ? r.json() : []).then(setItems).catch(() => setItems([])); }, []);
  const categories = ["All", ...Array.from(new Set(items.map(x => x.category || "General"))).sort()];
  const filtered = items.filter(x => (category === "All" || (x.category || "General") === category) && `${x.name} ${x.description ?? ""} ${x.category ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
    <div className="pointer-events-auto w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-5"><div><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Library</div><h2 className="mt-1 text-xl font-semibold">Reusable blocks</h2><p className="mt-1 text-xs text-zinc-500">Drag a block onto the canvas or click to insert it.</p></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100"><X size={18}/></button></div>
      <div className="border-b p-4"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search blocks…" className="w-full rounded-lg border px-3 py-2 text-sm"/><div className="mt-3 flex flex-wrap gap-1">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${category===c?"bg-zinc-900 text-white":"bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{c}</button>)}</div></div>
      <div className="max-h-[60vh] overflow-auto p-5">{filtered.length === 0 ? <div className="py-12 text-center text-sm text-zinc-500">No reusable blocks match your search.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(b => <div key={b.id} draggable onDragStart={e=>{e.dataTransfer.setData("application/x-vaultfoundry-block", b.id);e.dataTransfer.effectAllowed="copy"}} className="cursor-grab rounded-xl border p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50 active:cursor-grabbing"><button onClick={()=>onInsert(b.id)} className="w-full text-left"><div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-zinc-100">{b.component.type === "heading" ? <span className="font-bold">{String(b.component.props?.content ?? "Heading")}</span> : b.component.type === "text" ? <span className="text-xs text-zinc-500">{String(b.component.props?.content ?? "Text").slice(0,80)}</span> : b.component.type === "button" ? <span className="rounded bg-zinc-900 px-3 py-1 text-xs text-white">{String(b.component.props?.text ?? "Button")}</span> : <span className="text-xs text-zinc-400">{componentRegistry[b.component.type].label}</span>}</div><div className="font-semibold">{b.name}</div><div className="mt-1 text-xs text-zinc-500">{b.description || componentRegistry[b.component.type].description}</div><div className="mt-2 text-[10px] uppercase tracking-widest text-zinc-400">{b.category || "General"} · v{b.version}</div></button></div>)}</div>}</div>
    </div>
  </div>;
}

interface SendContact { id: string; email: string; firstName?: string | null; lastName?: string | null; status: string; }
interface SendList { id: string; name: string; memberCount: number; }

const resultLabel: Record<string, string> = { sent: "Sent", failed: "Failed", skipped: "Skipped (unsubscribed)" };
const resultColor: Record<string, string> = { sent: "text-emerald-600", failed: "text-red-600", skipped: "text-zinc-400" };

function SendModal({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const [contacts, setContacts] = useState<SendContact[]>([]);
  const [lists, setLists] = useState<SendList[]>([]);
  const [listMembers, setListMembers] = useState<Record<string, SendContact[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [results, setResults] = useState<{ email: string; status: "sent" | "failed" | "skipped"; error?: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
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
    const extraEmails = extra.split(/[\n,]/).map(e => e.trim()).filter(Boolean);
    const listEmails = [...selectedLists].flatMap(id => (listMembers[id] ?? []).filter(c => c.status !== "unsubscribed").map(c => c.email));
    const recipientEmails = [...new Set([...selected, ...listEmails, ...extraEmails])];
    if (recipientEmails.length === 0) { setError("Add at least one recipient."); return; }
    setError(""); setStatus("sending");
    const r = await fetch(`/api/emails/${emailId}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientEmails }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Could not send."); setStatus("idle"); return; }
    setResults(d.results ?? []);
    setStatus("done");
  };

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Send this email</h2><button onClick={onClose}><X size={18}/></button></div>

      {status === "done" ? (
        <div className="mt-5">
          <div className="space-y-1.5 max-h-64 overflow-auto">
            {results.map(r => <div key={r.email} className="flex items-center justify-between rounded-lg border p-2.5 text-sm"><span>{r.email}</span><span className={resultColor[r.status]}>{r.status === "failed" && r.error ? `Failed: ${r.error}` : resultLabel[r.status]}</span></div>)}
          </div>
          <button onClick={onClose} className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">Done</button>
        </div>
      ) : (
        <div className="mt-5">
          {lists.length > 0 && <div className="mb-4">
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
            <div className="max-h-48 space-y-1 overflow-auto rounded-lg border p-2">
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
            <textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="someone@example.com" className="mt-1.5 min-h-20 w-full rounded-lg border p-2.5 text-sm" />
          </label>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button onClick={send} disabled={status === "sending"} className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{status === "sending" ? "Sending…" : "Send"}</button>
        </div>
      )}
    </div>
  </div>, document.body);
}

interface EmailVersionSummary { id: string; versionNumber: number; createdAt: string; createdByName?: string | null; createdByEmail?: string | null; }

function HistoryPanel({ emailId, onClose, onRestore }: { emailId: string; onClose: () => void; onRestore: (document: EmailDocument) => void }) {
  const [versions, setVersions] = useState<EmailVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/emails/${emailId}/versions`).then(r => r.ok ? r.json() : { versions: [] }).then(d => setVersions(d.versions ?? [])).catch(() => setVersions([])).finally(() => setLoading(false));
  }, [emailId]);

  const preview = async (versionId: string) => {
    setPreviewId(versionId);
    setPreviewHtml("");
    const r = await fetch(`/api/emails/${emailId}/versions/${versionId}`);
    if (!r.ok) return;
    const v = await r.json();
    const renderRes = await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ document: v.document }) });
    const j = await renderRes.json().catch(() => ({}));
    setPreviewHtml(j.html ?? "");
  };

  const restore = async (versionId: string) => {
    if (!window.confirm("Restore this version? Your current canvas will be kept as its own version, so nothing is lost.")) return;
    setRestoringId(versionId);
    const r = await fetch(`/api/emails/${emailId}/versions/${versionId}/restore`, { method: "POST" });
    setRestoringId(null);
    if (!r.ok) return;
    const email = await r.json();
    onRestore(email.document);
  };

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="flex h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-2xl">
      <div className="w-72 shrink-0 overflow-auto border-r p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Version history</h2><button onClick={onClose}><X size={16}/></button></div>
        {loading ? <div className="p-4 text-center text-xs text-zinc-400">Loading…</div> : versions.length === 0 ? <div className="p-4 text-center text-xs text-zinc-400">No saved versions yet. Checkpoints are created automatically as you edit.</div> : (
          <div className="space-y-1">
            {versions.map(v => (
              <button key={v.id} onClick={() => preview(v.id)} className={`block w-full rounded-lg border p-2.5 text-left text-xs ${previewId === v.id ? "border-zinc-900 bg-zinc-50" : "border-transparent hover:bg-zinc-50"}`}>
                <div className="font-semibold">Version {v.versionNumber}</div>
                <div className="mt-0.5 text-zinc-500">{new Date(v.createdAt).toLocaleString()}</div>
                {(v.createdByName || v.createdByEmail) && <div className="mt-0.5 text-zinc-400">by {v.createdByName || v.createdByEmail}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        {!previewId ? <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Select a version to preview</div> : (
          <>
            <div className="flex items-center justify-between border-b p-4">
              <div className="text-sm font-medium">Preview</div>
              <button onClick={() => restore(previewId)} disabled={restoringId !== null} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{restoringId === previewId ? "Restoring…" : "Restore this version"}</button>
            </div>
            <div className="flex-1 overflow-auto bg-zinc-100 p-6">
              {previewHtml ? <iframe title="Version preview" srcDoc={previewHtml} className="mx-auto block min-h-[600px] w-full max-w-[640px] rounded-xl border-0 bg-white shadow-sm" /> : <div className="p-8 text-center text-xs text-zinc-400">Rendering…</div>}
            </div>
          </>
        )}
      </div>
    </div>
  </div>, document.body);
}

function DeviceButton({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className={`rounded-md p-2 ${active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>{children}</button>}

function Inspector({ selected, updateNode, updateNodeProps, updateStyle, addColumn, addRow, duplicate, remove, moveUp, moveDown }: { selected?: EmailComponent; updateNode:(k:string,v:unknown)=>void; updateNodeProps:(props:Record<string,unknown>)=>void; updateStyle:(k:string,v:string)=>void; addColumn:()=>void; addRow:()=>void; duplicate:()=>void; remove:()=>void; moveUp:()=>void; moveDown:()=>void }) {
  if (!selected) return <aside className="w-72 shrink-0 border-l bg-white p-5"><div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-500"><MousePointer2 className="mb-3 text-zinc-300"/><div className="font-medium text-zinc-700">Select a component</div><div className="mt-1 text-xs">Its properties will appear here.</div></div></aside>;
  const p = selected.props ?? {};
  return <aside className="w-72 shrink-0 overflow-auto border-l bg-white p-5"><div className="mb-4 flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Selected</div><div className="mt-1 text-lg font-semibold">{componentRegistry[selected.type].label}</div></div><button onClick={remove} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>
    <div className="mb-5 flex gap-1 rounded-lg bg-zinc-50 p-1"><button onClick={moveUp} className="flex-1 rounded p-1.5 hover:bg-white" title="Move up"><ChevronUp size={15} className="mx-auto"/></button><button onClick={moveDown} className="flex-1 rounded p-1.5 hover:bg-white" title="Move down"><ChevronDown size={15} className="mx-auto"/></button><button onClick={duplicate} className="flex-1 rounded p-1.5 hover:bg-white" title="Duplicate"><Copy size={15} className="mx-auto"/></button></div>
    {selected.type === "section" && <div className="mb-5 flex gap-2"><button onClick={addRow} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs font-semibold hover:bg-zinc-50"><Plus size={14}/> Add row</button><button onClick={addColumn} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs font-semibold hover:bg-zinc-50"><Plus size={14}/> Add column</button></div>}
    {selected.type === "text" || selected.type === "heading" || selected.type === "quote" ? <Field label="Content"><textarea value={String(p.content ?? "")} onChange={e => updateNode("content", e.target.value)} className="min-h-28 w-full rounded-lg border p-2 text-sm"/></Field> : null}
    {selected.type === "button" ? <><Field label="Button text"><input value={String(p.text ?? "")} onChange={e=>updateNode("text",e.target.value)} /></Field><Field label="Link"><LinkPicker value={String(p.linkId ?? "")} onChange={l=>updateNodeProps({linkId:l.id,href:l.destinationUrl})} /></Field></> : null}
    {selected.type === "image" ? <><Field label="Image"><AssetPicker value={String(p.assetId ?? "")} onChange={(asset:AssetRecord)=>updateNodeProps({assetId:asset.id,assetUrl:asset.publicUrl,alt:p.alt || asset.altText || ""})} /></Field><Field label="Alt text"><input value={String(p.alt ?? "")} onChange={e=>updateNode("alt",e.target.value)} /></Field><Field label="Link"><LinkPicker value={String(p.linkId ?? "")} onChange={l=>updateNodeProps({linkId:l.id,href:l.destinationUrl})} /></Field></> : null}
    {selected.type === "spacer" ? <Field label="Height"><input value={String(p.height ?? "24px")} onChange={e=>updateNode("height",e.target.value)} /></Field> : null}
    {selected.type === "html" ? <Field label="HTML"><textarea value={String(p.html ?? "")} onChange={e=>updateNode("html",e.target.value)} className="min-h-40 w-full rounded-lg border p-2 font-mono text-xs"/></Field> : null}
    {(selected.type === "text" || selected.type === "heading" || selected.type === "button") && <><div className="my-5 border-t"/><div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Appearance</div>
      <Field label="Font family">
        <select value={String(selected.styles?.fontFamily ?? "")} onChange={e=>updateStyle("fontFamily",e.target.value)}>
          <option value="">Default (Arial)</option>
          {FONT_STACKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Field>
      <Field label="Font size"><input value={String(selected.styles?.fontSize ?? "")} placeholder="16px" onChange={e=>updateStyle("fontSize",e.target.value)} /></Field>
      <Field label="Color"><input value={String(selected.styles?.color ?? "")} placeholder="#18181b" onChange={e=>updateStyle("color",e.target.value)} /></Field>
    </>}
    <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-[10px] text-zinc-500">Component ID<br/><code className="break-all text-zinc-700">{selected.id}</code></div>
  </aside>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mb-4 block text-xs font-semibold text-zinc-700">{label}<div className="mt-1.5">{children}</div></label>}

function SettingsPanel({document,commit,onClose}:{document:EmailDocument;commit:(d:EmailDocument)=>void;onClose:()=>void}){const m=document.metadata;const s=document.settings;const setM=(k:keyof typeof m,v:string)=>commit({...document,metadata:{...m,[k]:v}});const setS=(k:keyof typeof s,v:string|number)=>commit({...document,settings:{...s,[k]:v}});return <aside className="w-72 shrink-0 overflow-auto border-l bg-white p-5"><div className="mb-6 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email settings</div><div className="mt-1 text-lg font-semibold">General</div></div><button onClick={onClose}><X size={17}/></button></div><Field label="Email name"><input value={m.name ?? ""} onChange={e=>setM("name",e.target.value)} /></Field><Field label="Subject"><input value={m.subject ?? ""} onChange={e=>setM("subject",e.target.value)} /></Field><Field label="Preview text"><input value={m.previewText ?? ""} onChange={e=>setM("previewText",e.target.value)} /></Field><Field label="Content width"><input type="number" value={s.width} onChange={e=>setS("width",Number(e.target.value))} /></Field><Field label="Page background"><input type="text" value={s.backgroundColor} onChange={e=>setS("backgroundColor",e.target.value)} /></Field><Field label="Content background"><input type="text" value={s.contentBackgroundColor} onChange={e=>setS("contentBackgroundColor",e.target.value)} /></Field></aside>}

function PreviewPane({document,device,setDevice,showCode}:{document:EmailDocument;device:Device;setDevice:(d:Device)=>void;showCode:boolean}){const [html,setHtml]=useState("");useEffect(()=>{let alive=true;(async()=>{try{const r=await fetch("/api/render",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({document})});const j=await r.json();if(alive)setHtml(j.html||"")}catch{if(alive)setHtml("")}})();return()=>{alive=false}},[document]);return <main className="flex min-h-0 flex-1 overflow-hidden"><div className="flex-1 overflow-auto bg-zinc-100 p-8"><div className="mx-auto max-w-[760px]"><div className="mb-4 flex items-center justify-between"><div className="text-xs text-zinc-500">Rendered email preview</div><div className="flex rounded-lg border bg-white p-1"><DeviceButton active={device==="desktop"} onClick={()=>setDevice("desktop")}><Monitor size={14}/></DeviceButton><DeviceButton active={device==="tablet"} onClick={()=>setDevice("tablet")}><Tablet size={14}/></DeviceButton><DeviceButton active={device==="mobile"} onClick={()=>setDevice("mobile")}><Smartphone size={14}/></DeviceButton></div></div>{showCode?<pre className="max-h-[75vh] overflow-auto rounded-xl bg-zinc-950 p-5 text-xs text-zinc-200">{html || "Rendering…"}</pre>:<iframe title="Email preview" srcDoc={html} className="mx-auto block min-h-[720px] rounded-xl border-0 bg-white shadow-sm" style={{width:deviceWidths[device]+40}} />}</div></div></main>}
