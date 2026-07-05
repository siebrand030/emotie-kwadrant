"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/planner";
  const initialError = searchParams.get("error")
    ? "Inloggen mislukte. Vraag een nieuwe link aan."
    : "";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      next,
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
      setMessage(`Check je mail (${email}) voor de inloglink.`);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Inloggen</h1>
        <p className="text-muted text-sm">
          Vul je e-mailadres in — je krijgt een magische link om in te loggen.
          Geen wachtwoord nodig.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-3">
        <label htmlFor="email" className="sr-only">
          E-mailadres
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="jij@voorbeeld.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "sending" || status === "sent"}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "sent"}
          className="rounded-2xl bg-task-coral px-5 py-4 text-base font-medium text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {status === "sending"
            ? "Versturen…"
            : status === "sent"
              ? "Link verstuurd"
              : "Stuur inloglink"}
        </button>
      </form>

      {message && (
        <p
          className={`text-sm ${
            status === "error" ? "text-task-coral" : "text-muted"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
