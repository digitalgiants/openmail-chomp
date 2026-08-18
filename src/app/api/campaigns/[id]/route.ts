import { NextResponse } from "next/server";
import { getCampaignWithRecipients } from "@/lib/repository/campaign-store";
import { requireSession } from "@/lib/auth/session";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await getCampaignWithRecipients(session.organizationId, (await params).id);
  return campaign ? NextResponse.json(campaign) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
