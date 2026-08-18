"use client";
import { useState } from "react";

export function UnsubscribeConfirm({ contactId }: { contactId: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");

  const confirm = async () => {
    setStatus("working");
    const r = await fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactId }) });
    setStatus(r.ok ? "done" : "error");
  };

  if (status === "done") return <p className="mt-4 text-sm text-zinc-600">You've been unsubscribed. You won't receive future emails from this sender.</p>;

  return (
    <>
      <button onClick={confirm} disabled={status === "working"} className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {status === "working" ? "Unsubscribing…" : "Confirm unsubscribe"}
      </button>
      {status === "error" && <p className="mt-3 text-sm text-red-600">Something went wrong. Try again.</p>}
    </>
  );
}
