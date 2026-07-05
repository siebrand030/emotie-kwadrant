import Link from "next/link";
import { InboxList } from "@/components/planner/inbox-list";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <span className="text-muted truncate text-xs">{user?.email}</span>
        <SignOutButton />
      </div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <Link href="/planner" className="text-muted hover:text-fg text-sm">
          ← Tijdlijn
        </Link>
      </header>
      <InboxList />
    </main>
  );
}
