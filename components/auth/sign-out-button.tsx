"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-muted hover:text-fg text-sm underline-offset-4 hover:underline disabled:opacity-50"
    >
      {busy ? "Uitloggen…" : "Uitloggen"}
    </button>
  );
}
