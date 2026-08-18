"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Pencil, Trash2, UserPlus, X } from "lucide-react";
import type { auth } from "@/lib/auth/auth";
import { authClient } from "@/lib/auth/client";

type Organization = NonNullable<Awaited<ReturnType<typeof auth.api.getFullOrganization>>>;
type Role = "owner" | "admin" | "member";

const roles: Role[] = ["owner", "admin", "member"];

export function SettingsPanel({ organization, currentUserId }: { organization: Organization; currentUserId: string }) {
  const router = useRouter();
  const currentMember = organization.members.find(m => m.userId === currentUserId);
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

  const [name, setName] = useState(organization.name);
  const [savingName, setSavingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => router.refresh();

  const saveName = async () => {
    if (!name.trim() || name === organization.name) return;
    setSavingName(true);
    const { error } = await authClient.organization.update({ organizationId: organization.id, data: { name: name.trim() } });
    setSavingName(false);
    if (error) setError(error.message ?? "Could not rename workspace.");
    else refresh();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    const { error } = await authClient.organization.inviteMember({ email: inviteEmail.trim(), role: inviteRole, organizationId: organization.id });
    setInviting(false);
    if (error) setError(error.message ?? "Could not send invitation.");
    else {
      setInviteEmail("");
      refresh();
    }
  };

  const changeRole = async (memberId: string, role: Role) => {
    const { error } = await authClient.organization.updateMemberRole({ memberId, role, organizationId: organization.id });
    if (error) setError(error.message ?? "Could not update role.");
    else refresh();
  };

  const removeMember = async (memberIdOrEmail: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail, organizationId: organization.id });
    if (error) setError(error.message ?? "Could not remove member.");
    else refresh();
  };

  const cancelInvitation = async (invitationId: string) => {
    const { error } = await authClient.organization.cancelInvitation({ invitationId });
    if (error) setError(error.message ?? "Could not cancel invitation.");
    else refresh();
  };

  return (
    <div className="max-w-3xl space-y-8">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <section className="rounded-xl border bg-white p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace</div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!canManage}
            className="w-full max-w-sm rounded-lg border p-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          {canManage && (
            <button
              onClick={saveName}
              disabled={savingName || !name.trim() || name === organization.name}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Pencil size={13} /> {savingName ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-zinc-400">Slug: {organization.slug}</div>
      </section>

      {canManage && (
        <section className="rounded-xl border bg-white p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Invite a teammate</div>
          <form onSubmit={sendInvite} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="min-w-[220px] flex-1 rounded-lg border p-2 text-sm"
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)} className="rounded-lg border p-2 text-sm">
              {roles.filter(r => r !== "owner").map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button disabled={inviting} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <UserPlus size={15} /> {inviting ? "Sending…" : "Invite"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Members</div>
        <div className="mt-3 divide-y">
          {organization.members.map(member => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium">{member.user.name || member.user.email}</div>
                <div className="text-xs text-zinc-500">{member.user.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && member.userId !== currentUserId ? (
                  <select
                    value={member.role}
                    onChange={e => changeRole(member.id, e.target.value as Role)}
                    className="rounded-lg border px-2 py-1.5 text-xs"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-zinc-600">{member.role}</span>
                )}
                {canManage && member.userId !== currentUserId && (
                  <button onClick={() => removeMember(member.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Remove">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canManage && organization.invitations.filter(i => i.status === "pending").length > 0 && (
        <section className="rounded-xl border bg-white p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pending invitations</div>
          <div className="mt-3 divide-y">
            {organization.invitations.filter(i => i.status === "pending").map(invitation => (
              <div key={invitation.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-zinc-400" />
                  {invitation.email}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{invitation.role}</span>
                </div>
                <button onClick={() => cancelInvitation(invitation.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Cancel invitation">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
