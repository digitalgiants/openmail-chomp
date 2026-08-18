// Thin wrapper around Resend's Domains API (create/inspect/verify/delete a
// sending domain). Kept separate from resend.ts since that file is about
// sending mail through an already-configured provider, not managing which
// domains are allowed to send.
//
// Not exercised against the live API from this environment -- the request
// shapes below match Resend's published API, but verify against a real
// domain before relying on it in production.
const RESEND_API_BASE = "https://api.resend.com";

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status?: string;
  value: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: ResendDomainRecord[];
}

function authHeaders() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
}

export async function createResendDomain(domain: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: domain }) });
  if (!res.ok) throw new Error(`Resend domain create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getResendDomain(providerId: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${providerId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Resend domain lookup failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function verifyResendDomain(providerId: string): Promise<void> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${providerId}/verify`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(`Resend domain verify failed: ${res.status} ${await res.text()}`);
}

export async function deleteResendDomain(providerId: string): Promise<void> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${providerId}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`Resend domain delete failed: ${res.status} ${await res.text()}`);
}
