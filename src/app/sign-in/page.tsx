"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" });
    setStatus(error ? "error" : "sent");
  };

  const signInWithGoogle = () => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">◈ VaultFoundry</div>
          <p className="mt-2 text-sm text-zinc-500">Sign in to your workspace.</p>
        </div>

        <button onClick={signInWithGoogle} className="mt-6 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50">
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200" /> or <div className="h-px flex-1 bg-zinc-200" />
        </div>

        {status === "sent" ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-center text-sm text-zinc-600">Check {email} for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border p-2.5 text-sm"
            />
            <button disabled={status === "sending"} className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && <p className="text-center text-sm text-red-600">Something went wrong. Try again.</p>}
          </form>
        )}
      </div>
    </div>
  );
}
