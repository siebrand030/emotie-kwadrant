import Link from "next/link";

/**
 * /tools — overzicht van tools binnen de app. Voor nu is de dagplanner de enige
 * tool; hij opent op /planner. Gebaseerd op het tools-scherm uit het Claude
 * Design-prototype (donkere shell, IBM Plex, accent = taakkleur 0).
 */
export default function ToolsPage() {
  return (
    <main className="font-plex mx-auto flex min-h-dvh max-w-md flex-col bg-[#0B0C0D] text-[#E9EBEA]">
      <div className="flex-1 overflow-y-auto px-[22px] pt-[34px] pb-6">
        <h1 className="font-plex-mono mb-5 text-[11.5px] text-[#565C60]">tools</h1>

        <Link
          href="/planner"
          className="border-planner-accent-line bg-planner-accent-tint flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition active:scale-[0.98]"
        >
          <span className="bg-planner-accent flex size-11 flex-none items-center justify-center rounded-full text-lg font-semibold text-[#0B0C0D]">
            P
          </span>
          <span className="flex flex-1 flex-col gap-[3px]">
            <span className="text-base font-medium text-[#E9EBEA]">Planner</span>
            <span className="text-xs text-[#7A8084]">
              Structureer je dag rond je energie
            </span>
          </span>
          <span className="text-lg text-[#565C60]">›</span>
        </Link>
      </div>
    </main>
  );
}
