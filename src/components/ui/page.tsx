export function Page({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="p-8"><div className="flex items-start justify-between mb-8"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}</div>{action}</div>{children}</div>;
}
