import { notFound, redirect } from "next/navigation";
import { Builder } from "@/components/email/builder";
import { getEmail } from "@/lib/repository/email-store";
import { requireSession } from "@/lib/auth/session";
export default async function EmailBuilderPage({params}:{params:Promise<{id:string}>}){const session=await requireSession();if(!session)redirect("/sign-in");const {id}=await params;const email=await getEmail(session.organizationId,id);if(!email)notFound();return <Builder initialDocument={email.document} emailId={email.id}/>}
