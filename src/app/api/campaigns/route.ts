import { NextResponse } from "next/server";
import { listCampaigns } from "@/lib/repository/campaign-store";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ campaigns: await listCampaigns(session.organizationId) });
}
