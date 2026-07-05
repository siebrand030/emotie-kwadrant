import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * Home = het incheck-scherm ("nu"). De emotie-logger wordt hier later
 * gemigreerd; tot die tijd staat er een korte toelichting. De dagplanner en
 * andere tools bereik je via de onderbalk → Tools.
 */
export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Emotie-bibliotheek
          </h1>
          <p className="text-muted text-sm">
            Migratie naar Next.js in uitvoering. De emotie-logger komt hier; de
            dagplanner vind je onder Tools.
          </p>
        </header>
      </main>
      <BottomNav />
    </div>
  );
}
