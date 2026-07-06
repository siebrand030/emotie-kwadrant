import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-callback voor de magic link. Supabase stuurt de gebruiker hierheen met
 * een `code` (PKCE) die we omwisselen voor een sessie. Daarna door naar de
 * oorspronkelijk gevraagde pagina (`next`) of de planner.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Geen code of omwisseling mislukt → terug naar login met foutmelding.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
