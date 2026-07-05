import Link from "next/link";
import { PlannerTimeline } from "@/components/planner/planner-timeline";

export default function PlannerPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dagplanner</h1>
        <Link href="/inbox" className="text-muted text-sm hover:text-fg">
          Inbox →
        </Link>
      </header>
      <PlannerTimeline />
    </main>
  );
}
