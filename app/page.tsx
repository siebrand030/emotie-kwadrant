import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Emotie-bibliotheek</h1>
        <p className="text-muted text-sm">
          Migratie naar Next.js in uitvoering. De emotie-logger en de nieuwe
          dagplanner komen hier samen.
        </p>
      </header>

      <nav className="grid gap-3">
        <Link
          href="/planner"
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base transition hover:bg-white/10"
        >
          Dagplanner — tijdlijn
        </Link>
        <Link
          href="/inbox"
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base transition hover:bg-white/10"
        >
          Inbox — ongeplande taken
        </Link>
      </nav>
    </main>
  );
}
