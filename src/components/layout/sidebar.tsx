"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Mail, PanelsTopLeft, Blocks, Image, Link2, Users, Send, Settings, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { OrgSwitcher } from "./org-switcher";

const sections = [
  { label: "WORKSPACE", items: [
    ["Dashboard", "/dashboard", LayoutDashboard], ["Emails", "/emails", Mail], ["Templates", "/templates", PanelsTopLeft], ["Blocks", "/blocks", Blocks], ["Assets", "/assets", Image], ["Links", "/links", Link2]
  ]},
  { label: "AUDIENCE", items: [["Contacts", "/contacts", Users], ["Campaigns", "/campaigns", Send]]},
  { label: "SYSTEM", items: [["Settings", "/settings", Settings]] }
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = () => authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/sign-in") } });
  return <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white min-h-screen p-4 flex flex-col">
    <div className="px-3 pt-4 pb-3"><div className="font-bold tracking-tight text-xl">◈ VaultFoundry</div></div>
    <OrgSwitcher />
    {sections.map(section => <div key={section.label} className="mb-6"><div className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-zinc-400">{section.label}</div>
      {section.items.map(([label, href, Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 ${pathname === href ? "bg-zinc-100 font-medium" : "text-zinc-600 hover:bg-zinc-50"}`}><Icon size={17}/>{label}</Link>)}
    </div>)}
    <button onClick={signOut} className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50"><LogOut size={17}/>Sign out</button>
  </aside>;
}
