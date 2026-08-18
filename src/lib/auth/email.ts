async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[auth] Email to ${to} (${subject}):\n${html}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "VaultFoundry <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Failed to send email: ${res.status} ${await res.text()}`);
}

export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  await sendEmail({
    to: email,
    subject: "Sign in to VaultFoundry",
    html: `<p>Click below to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 5 minutes.</p>`,
  });
}

export async function sendInvitationEmail(data: { email: string; id: string; organization: { name: string }; inviter: { user: { name?: string | null; email: string } } }) {
  const url = `${process.env.BETTER_AUTH_URL}/accept-invitation?id=${data.id}`;
  const inviterName = data.inviter.user.name || data.inviter.user.email;
  await sendEmail({
    to: data.email,
    subject: `${inviterName} invited you to join ${data.organization.name} on VaultFoundry`,
    html: `<p>${inviterName} invited you to join <strong>${data.organization.name}</strong> on VaultFoundry.</p><p><a href="${url}">${url}</a></p><p>This invitation expires in 48 hours.</p>`,
  });
}
