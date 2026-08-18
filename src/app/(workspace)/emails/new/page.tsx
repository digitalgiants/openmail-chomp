import { redirect } from "next/navigation";
import { createEmail } from "@/lib/repository/email-store";
import { starterEmailDocument } from "@/lib/email/defaults";
import { requireSession } from "@/lib/auth/session";
export default async function NewEmailPage(){const session=await requireSession();if(!session)redirect("/sign-in");const email=await createEmail(session.organizationId,session.user.id,{name:"Untitled Email",document:starterEmailDocument()});redirect(`/emails/${email.id}/builder`)}
