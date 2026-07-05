import Link from "next/link";
import { InboxList } from "@/components/planner/inbox-list";

export default function InboxPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <Link href="/planner" className="text-muted text-sm hover:text-fg">
          ← Tijdlijn
        </Link>
      </header>
      <InboxList />
    </main>
  );
}
