"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet, Undo2, Redo2, Save, Eye, Code2, Settings2, Trash2, Copy, GripVertical, ChevronUp, ChevronDown, Plus, X, LayoutTemplate, MousePointer2, Blocks, LibraryBig } from "lucide-react";
import { componentRegistry, builderComponents, type EmailComponent, type EmailDocument } from "@/lib/email";
import { AssetPicker } from "./asset-picker";
import { LinkPicker } from "./link-picker";
import type { AssetRecord } from "@/lib/assets/types";

function uid(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

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

function moveRoot(nodes: EmailComponent[], id: string, delta: -1 | 1) {
  const index = nodes.findIndex(n => n.id === id);
  if (index < 0) return nodes;
  const target = index + delta;
  if (target < 0 || target >= nodes.length) return nodes;
  const next = [...nodes]; [next[index], next[target]] = [next[target], next[index]]; return next;
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
    case "button": return wrap(<div className="py-2"><span className="inline-block rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white">{String(p.text ?? "Learn More")}</span></div>);
    case "image": return wrap(p.assetUrl ? <img src={String(p.assetUrl)} alt={String(p.alt ?? "")} className="max-h-96 w-full object-contain" style={node.styles} /> : <div className="flex h-40 items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400">Choose an image</div>);
    case "divider": return wrap(<hr className="my-2 border-zinc-200" />);
    case "spacer": return wrap(<div style={{ height: String(p.height ?? "24px") }} />);
    case "html": return wrap(<div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-xs text-zinc-500">Custom HTML block</div>);
    case "section": return wrap(<div className="space-y-4" style={{ backgroundColor: String(p.backgroundColor ?? "#ffffff"), paddingTop: String(p.paddingTop ?? "24px"), paddingBottom: String(p.paddingBottom ?? "24px"), paddingLeft: "24px", paddingRight: "24px" }}>{node.children?.map(child => <ComponentVisual key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}</div>);
    case "column":
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
    commit({ ...document, children: mapNodes(document.children, selectedId, n => ({ ...n, styles: { ...(n.styles ?? {}), [key]: value } })) });
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
    commit({ ...document, children: [...document.children, node] }); setSelectedId(node.id);
  };

  const addColumn = () => {
    if (!selected || selected.type !== "section") return;
    const children = selected.children ?? [];
    if (children.length >= 3) return;
    const width = `${100 / (children.length + 1)}%`;
    const cols = [...children.map(c => ({ ...c, props: { ...(c.props ?? {}), width } })), { id: uid("column"), type: "column" as const, props: { width }, children: [] }];
    commit({ ...document, children: mapNodes(document.children, selected.id, n => ({ ...n, children: cols })) });
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
        <button onClick={saveAsTemplate} className="ml-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><LayoutTemplate size={15}/> Save template</button>
        <button onClick={saveAsBlock} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><Blocks size={15}/> Save block</button>
        <button onClick={() => setLibrary("blocks")} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><LibraryBig size={15}/> Library</button>
        <button onClick={() => setSaveState("unsaved")} className="ml-1 flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"><Save size={15}/> Save</button>
      </div>
    </header>

    {showPreview ? <PreviewPane document={document} device={device} setDevice={setDevice} showCode={showCode} /> : <div className="flex min-h-0 flex-1">
      <aside className="w-60 shrink-0 overflow-auto border-r bg-white p-4"><div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Content</div><div className="grid grid-cols-2 gap-2">{builderComponents.map(def => <button key={def.type} onClick={() => add(def.type)} className="rounded-lg border border-zinc-200 p-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50"><div className="text-lg">{def.icon}</div><div className="mt-1 text-xs font-semibold">{def.label}</div><div className="text-[10px] leading-4 text-zinc-500">{def.description}</div></button>)}</div><div className="mt-7 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500"><div className="font-semibold text-zinc-700">Tip</div> Drag components on the canvas to reorder them. Select a section to add columns.</div></aside>
      <main className="min-w-0 flex-1 overflow-auto bg-zinc-100 p-8"><div className="mx-auto max-w-[760px]">
        <div className="mb-4 flex items-center justify-between"><div className="text-xs text-zinc-500">Email canvas</div><div className="flex items-center gap-1 rounded-lg border bg-white p-1"><DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={14}/></DeviceButton><DeviceButton active={device === "tablet"} onClick={() => setDevice("tablet")}><Tablet size={14}/></DeviceButton><DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={14}/></DeviceButton></div></div>
        <div className="mx-auto rounded-xl bg-white p-5 shadow-sm transition-all" style={{ width: deviceWidths[device] + 40 }} onClick={() => setSelectedId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(null,e)}>
          {document.children.length === 0 ? <div onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(null,e)} className="flex h-96 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center"><MousePointer2 className="mb-3 text-zinc-300"/><div className="text-sm font-medium">Start building your email</div><div className="mt-1 max-w-xs text-xs text-zinc-500">Add a section, text, image, button, or other component from the left.</div></div> : <div className="mx-auto" style={{ width: deviceWidths[device] }}>
            {document.children.map(node => <div key={node.id} draggable onDragStart={() => { dragId.current = node.id; }} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(node.id, e)} className="relative mb-2"><div className="absolute -left-8 top-2 opacity-0 transition group-hover:opacity-100"><GripVertical size={16}/></div><ComponentVisual node={node} selectedId={selectedId} onSelect={setSelectedId}/></div>)}
          </div>}
        </div>
      </div></main>
      {showSettings ? <SettingsPanel document={document} commit={commit} onClose={() => setShowSettings(false)} /> : <Inspector selected={selected} updateNode={updateNode} updateNodeProps={updateNodeProps} updateStyle={updateStyle} addColumn={addColumn} duplicate={duplicateSelected} remove={deleteSelected} moveUp={() => selectedId && commit({ ...document, children: moveRoot(document.children, selectedId, -1) })} moveDown={() => selectedId && commit({ ...document, children: moveRoot(document.children, selectedId, 1) })} />}
    </div>}
    {library === "blocks" && <BlockLibrary onClose={() => setLibrary(null)} onInsert={insertBlock} />}
  </div>;
}

function BlockLibrary({ onClose, onInsert }: { onClose: () => void; onInsert: (id: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; name: string; description?: string; category?: string; version: number; component: EmailComponent }>>([]);
  const [q, setQ] = useState(""); const [category, setCategory] = useState("All");
  useEffect(() => { fetch("/api/blocks").then(r => r.json()).then(setItems); }, []);
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

function DeviceButton({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className={`rounded-md p-2 ${active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>{children}</button>}

function Inspector({ selected, updateNode, updateNodeProps, updateStyle, addColumn, duplicate, remove, moveUp, moveDown }: { selected?: EmailComponent; updateNode:(k:string,v:unknown)=>void; updateNodeProps:(props:Record<string,unknown>)=>void; updateStyle:(k:string,v:string)=>void; addColumn:()=>void; duplicate:()=>void; remove:()=>void; moveUp:()=>void; moveDown:()=>void }) {
  if (!selected) return <aside className="w-72 shrink-0 border-l bg-white p-5"><div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-500"><MousePointer2 className="mb-3 text-zinc-300"/><div className="font-medium text-zinc-700">Select a component</div><div className="mt-1 text-xs">Its properties will appear here.</div></div></aside>;
  const p = selected.props ?? {};
  return <aside className="w-72 shrink-0 overflow-auto border-l bg-white p-5"><div className="mb-4 flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Selected</div><div className="mt-1 text-lg font-semibold">{componentRegistry[selected.type].label}</div></div><button onClick={remove} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>
    <div className="mb-5 flex gap-1 rounded-lg bg-zinc-50 p-1"><button onClick={moveUp} className="flex-1 rounded p-1.5 hover:bg-white" title="Move up"><ChevronUp size={15} className="mx-auto"/></button><button onClick={moveDown} className="flex-1 rounded p-1.5 hover:bg-white" title="Move down"><ChevronDown size={15} className="mx-auto"/></button><button onClick={duplicate} className="flex-1 rounded p-1.5 hover:bg-white" title="Duplicate"><Copy size={15} className="mx-auto"/></button></div>
    {selected.type === "section" && <button onClick={addColumn} className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs font-semibold hover:bg-zinc-50"><Plus size={14}/> Add column</button>}
    {selected.type === "text" || selected.type === "heading" || selected.type === "quote" ? <Field label="Content"><textarea value={String(p.content ?? "")} onChange={e => updateNode("content", e.target.value)} className="min-h-28 w-full rounded-lg border p-2 text-sm"/></Field> : null}
    {selected.type === "button" ? <><Field label="Button text"><input value={String(p.text ?? "")} onChange={e=>updateNode("text",e.target.value)} /></Field><Field label="Link"><LinkPicker value={String(p.linkId ?? "")} onChange={l=>updateNodeProps({linkId:l.id,href:l.destinationUrl})} /></Field></> : null}
    {selected.type === "image" ? <><Field label="Image"><AssetPicker value={String(p.assetId ?? "")} onChange={(asset:AssetRecord)=>updateNodeProps({assetId:asset.id,assetUrl:asset.publicUrl,alt:p.alt || asset.altText || ""})} /></Field><Field label="Alt text"><input value={String(p.alt ?? "")} onChange={e=>updateNode("alt",e.target.value)} /></Field><Field label="Link"><LinkPicker value={String(p.linkId ?? "")} onChange={l=>updateNodeProps({linkId:l.id,href:l.destinationUrl})} /></Field></> : null}
    {selected.type === "spacer" ? <Field label="Height"><input value={String(p.height ?? "24px")} onChange={e=>updateNode("height",e.target.value)} /></Field> : null}
    {selected.type === "html" ? <Field label="HTML"><textarea value={String(p.html ?? "")} onChange={e=>updateNode("html",e.target.value)} className="min-h-40 w-full rounded-lg border p-2 font-mono text-xs"/></Field> : null}
    {(selected.type === "text" || selected.type === "heading" || selected.type === "button") && <><div className="my-5 border-t"/><div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Appearance</div><Field label="Font size"><input value={String(selected.styles?.fontSize ?? "")} placeholder="16px" onChange={e=>updateStyle("fontSize",e.target.value)} /></Field><Field label="Color"><input value={String(selected.styles?.color ?? "")} placeholder="#18181b" onChange={e=>updateStyle("color",e.target.value)} /></Field></>}
    <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-[10px] text-zinc-500">Component ID<br/><code className="break-all text-zinc-700">{selected.id}</code></div>
  </aside>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mb-4 block text-xs font-semibold text-zinc-700">{label}<div className="mt-1.5">{children}</div></label>}

function SettingsPanel({document,commit,onClose}:{document:EmailDocument;commit:(d:EmailDocument)=>void;onClose:()=>void}){const m=document.metadata;const s=document.settings;const setM=(k:keyof typeof m,v:string)=>commit({...document,metadata:{...m,[k]:v}});const setS=(k:keyof typeof s,v:string|number)=>commit({...document,settings:{...s,[k]:v}});return <aside className="w-72 shrink-0 overflow-auto border-l bg-white p-5"><div className="mb-6 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email settings</div><div className="mt-1 text-lg font-semibold">General</div></div><button onClick={onClose}><X size={17}/></button></div><Field label="Email name"><input value={m.name ?? ""} onChange={e=>setM("name",e.target.value)} /></Field><Field label="Subject"><input value={m.subject ?? ""} onChange={e=>setM("subject",e.target.value)} /></Field><Field label="Preview text"><input value={m.previewText ?? ""} onChange={e=>setM("previewText",e.target.value)} /></Field><Field label="Content width"><input type="number" value={s.width} onChange={e=>setS("width",Number(e.target.value))} /></Field><Field label="Page background"><input type="text" value={s.backgroundColor} onChange={e=>setS("backgroundColor",e.target.value)} /></Field><Field label="Content background"><input type="text" value={s.contentBackgroundColor} onChange={e=>setS("contentBackgroundColor",e.target.value)} /></Field></aside>}

function PreviewPane({document,device,setDevice,showCode}:{document:EmailDocument;device:Device;setDevice:(d:Device)=>void;showCode:boolean}){const [html,setHtml]=useState("");useEffect(()=>{let alive=true;(async()=>{try{const r=await fetch("/api/render",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({document})});const j=await r.json();if(alive)setHtml(j.html||"")}catch{if(alive)setHtml("")}})();return()=>{alive=false}},[document]);return <main className="flex min-h-0 flex-1 overflow-hidden"><div className="flex-1 overflow-auto bg-zinc-100 p-8"><div className="mx-auto max-w-[760px]"><div className="mb-4 flex items-center justify-between"><div className="text-xs text-zinc-500">Rendered email preview</div><div className="flex rounded-lg border bg-white p-1"><DeviceButton active={device==="desktop"} onClick={()=>setDevice("desktop")}><Monitor size={14}/></DeviceButton><DeviceButton active={device==="tablet"} onClick={()=>setDevice("tablet")}><Tablet size={14}/></DeviceButton><DeviceButton active={device==="mobile"} onClick={()=>setDevice("mobile")}><Smartphone size={14}/></DeviceButton></div></div>{showCode?<pre className="max-h-[75vh] overflow-auto rounded-xl bg-zinc-950 p-5 text-xs text-zinc-200">{html || "Rendering…"}</pre>:<iframe title="Email preview" srcDoc={html} className="mx-auto block min-h-[720px] rounded-xl border-0 bg-white shadow-sm" style={{width:deviceWidths[device]+40}} />}</div></div></main>}
