import { BottomNav } from "@/components/nav/bottom-nav";

/**
 * /inzichten — placeholder. Het inzichten-scherm (weekverdeling, dagdelen,
 * tijdlijn) wordt later gemigreerd uit de emotie-logger. Bestaat nu alleen om
 * de onderbalk uit het design coherent te maken.
 */
export default function InzichtenPage() {
  return (
    <main className="font-plex mx-auto flex min-h-dvh max-w-md flex-col bg-[#0B0C0D] text-[#E9EBEA]">
      <div className="flex flex-1 items-center justify-center">
        <span className="font-plex-mono text-xs text-[#3E4448]">
          inzichten — volgt later
        </span>
      </div>
      <BottomNav />
    </main>
  );
}
