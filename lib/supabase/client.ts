import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Supabase-client voor gebruik in client components (browser).
 * Vereist NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
