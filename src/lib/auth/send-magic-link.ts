export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[auth] Magic link for ${email}: ${url}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "VaultFoundry <onboarding@resend.dev>",
      to: email,
      subject: "Sign in to VaultFoundry",
      html: `<p>Click below to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 5 minutes.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Failed to send magic link email: ${res.status} ${await res.text()}`);
}
