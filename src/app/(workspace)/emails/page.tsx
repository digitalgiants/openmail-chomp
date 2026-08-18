import Link from "next/link";

export default function EmailsPage() {
  return <div className="p-8"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between"><div><p className="text-sm text-zinc-500">Workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Emails</h1></div><Link href="/emails/new" className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">Create email</Link></div><div className="mt-8 rounded-xl border bg-white p-6"><div className="font-medium">Untitled Email</div><div className="mt-1 text-sm text-zinc-500">Draft · Builder foundation</div><Link href="/emails/demo/builder" className="mt-4 inline-block text-sm font-medium underline">Open builder →</Link></div></div></div>;
}
