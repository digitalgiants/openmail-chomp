import { NextResponse } from "next/server";
import { createContact, listContacts } from "@/lib/repository/contact-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ contacts: await listContacts(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  try {
    const contact = await createContact(session.organizationId, {
      email,
      firstName: body.firstName?.trim() || undefined,
      lastName: body.lastName?.trim() || undefined,
      status: body.status || undefined,
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This email is already a contact" }, { status: 409 });
    }
    throw error;
  }
}
