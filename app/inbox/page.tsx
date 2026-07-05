import { redirect } from "next/navigation";

/**
 * De inbox is nu een tab binnen de planner (inbox en tijdlijn delen de
 * tasks-tabel). Deze route bestaat alleen nog als redirect zodat oude links
 * blijven werken.
 */
export default function InboxPage() {
  redirect("/planner");
}
