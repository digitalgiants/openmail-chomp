"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitation />
    </Suspense>
  );
}

function AcceptInvitation() {
  const router = useRouter();
  const invitationId = useSearchParams().get("id");
  const [status, setStatus] = useState<"pending" | "error">("pending");
  const [message, setMessage] = useState("Joining workspace…");

  useEffect(() => {
    if (!invitationId) {
      setStatus("error");
      setMessage("This invitation link is missing its ID.");
      return;
    }
    authClient.organization.acceptInvitation({ invitationId }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message ?? "This invitation is no longer valid.");
        return;
      }
      router.push("/dashboard");
    });
  }, [invitationId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="text-xl font-bold tracking-tight">◈ VaultFoundry</div>
        <p className="mt-4 text-sm text-zinc-600">{message}</p>
        {status === "error" && (
          <a href="/dashboard" className="mt-4 inline-block text-sm font-medium underline">
            Go to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
