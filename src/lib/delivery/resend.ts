import type { DeliveryProvider, DeliveryResult, EmailMessage } from "./types";

export class ResendDeliveryProvider implements DeliveryProvider {
  async send(message: EmailMessage): Promise<DeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { id: data.id, provider: "resend" };
  }

  // Resend's batch endpoint accepts up to 100 messages per call. Chunking
  // to that limit is the caller's responsibility (campaign-store.ts does
  // it), since the right chunk size is a provider detail, not something
  // send code elsewhere should need to know.
  async sendBatch(messages: EmailMessage[]): Promise<DeliveryResult[]> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(messages.map(message => ({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }))),
    });
    if (!res.ok) throw new Error(`Resend batch send failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    // Docs describe the response as { data: [{ id }, ...] }, but be
    // defensive in case a raw array comes back instead -- this hasn't
    // been exercised against the live API from this environment.
    const items: Array<{ id: string }> = Array.isArray(data) ? data : (data.data ?? []);
    return items.map(item => ({ id: item.id, provider: "resend" }));
  }
}
