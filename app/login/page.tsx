"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";
type Status = "idle" | "working" | "confirm" | "error";

/** Vertaalt Supabase-authfouten naar begrijpelijke Nederlandse meldingen. */
function messageForError(error: AuthError, mode: Mode): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mailadres of wachtwoord is onjuist.";
    case "email_not_confirmed":
      return "Bevestig eerst je e-mailadres via de link in je mailbox.";
    case "user_already_exists":
    case "email_exists":
      return "Er bestaat al een account met dit e-mailadres. Log in.";
    case "weak_password":
      return "Kies een sterker wachtwoord (minimaal 6 tekens).";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Te veel pogingen. Probeer het over een paar minuten opnieuw.";
    case "validation_failed":
      return "Vul een geldig e-mailadres en wachtwoord in.";
    default:
      // Fallback: onbekend account geeft soms geen code terug.
      if (mode === "signin") {
        return "Inloggen mislukte. Controleer je e-mailadres en wachtwoord.";
      }
      return error.message || "Er ging iets mis. Probeer het opnieuw.";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const initialError = searchParams.get("error")
    ? "Inloggen mislukte. Probeer het opnieuw."
    : "";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(initialError ? "error" : "idle");
  const [message, setMessage] = useState(initialError);

  const busy = status === "working";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        next,
      )}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      if (error) {
        setStatus("error");
        setMessage(messageForError(error, mode));
        return;
      }

      // Staat e-mailbevestiging aan in Supabase, dan is er nog geen sessie.
      if (!data.session) {
        setStatus("confirm");
        setMessage(
          `Bevestig je account via de link die we naar ${email} stuurden.`,
        );
        return;
      }

      // Bevestiging uit → direct ingelogd.
      router.replace(next);
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setMessage(messageForError(error, mode));
      return;
    }

    // Sessie staat nu in cookies (@supabase/ssr) — blijft na reload/PWA behouden.
    router.replace(next);
    router.refresh();
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setStatus("idle");
    setMessage("");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "signin" ? "Inloggen" : "Account aanmaken"}
        </h1>
        <p className="text-muted text-sm">
          {mode === "signin"
            ? "Log in met je e-mailadres en wachtwoord."
            : "Maak een account aan met je e-mailadres en een wachtwoord."}
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
          disabled={busy}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-50"
        />

        <label htmlFor="password" className="sr-only">
          Wachtwoord
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Wachtwoord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-task-coral px-5 py-4 text-base font-medium text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? mode === "signin"
              ? "Inloggen…"
              : "Account aanmaken…"
            : mode === "signin"
              ? "Inloggen"
              : "Account aanmaken"}
        </button>
      </form>

      {message && (
        <p
          className={`text-sm ${
            status === "error" ? "text-task-coral" : "text-muted"
          }`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      <p className="text-muted text-center text-sm">
        {mode === "signin" ? (
          <>
            Nog geen account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-white underline underline-offset-4 hover:opacity-80"
            >
              Account aanmaken
            </button>
          </>
        ) : (
          <>
            Al een account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-white underline underline-offset-4 hover:opacity-80"
            >
              Inloggen
            </button>
          </>
        )}
      </p>
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
