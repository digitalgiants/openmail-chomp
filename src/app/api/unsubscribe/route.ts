import { NextResponse } from "next/server";
import { unsubscribeContactById } from "@/lib/repository/contact-store";

// Intentionally public — the recipient clicking this from their inbox
// isn't signed into the app.
export async function POST(request: Request) {
  const body = await request.json();
  const contactId = String(body.contactId ?? "");
  if (!contactId) return NextResponse.json({ error: "Missing contact id" }, { status: 400 });

  const contact = await unsubscribeContactById(contactId);
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ email: contact.email });
}
