/**
 * Handmatig datamodel voor de `tasks`-tabel. Vervang dit later door de
 * gegenereerde types (`supabase gen types typescript`).
 *
 * Conventie: inbox en tijdlijn delen bewust één tabel. Het `status`-veld
 * bepaalt waar een taak thuishoort:
 *   - 'inbox'     → ongepland; date/start_time zijn null
 *   - 'scheduled' → ingepland; date en start_time zijn gevuld
 * Inplannen = status-update naar 'scheduled' + date/start_time invullen.
 */

export type TaskStatus = "inbox" | "scheduled";

/**
 * De 8 taakkleuren uit het Claude Design-prototype — oklch(72% 0.085 <hue>),
 * alleen de hue verschilt (zie app/globals.css). Kleur 0 = coral (hue 25) is
 * de DB-default. Opgeslagen als kleurnaam in het `color`-veld (text).
 */
export type TaskColor =
  | "coral"
  | "amber"
  | "lime"
  | "mint"
  | "teal"
  | "sky"
  | "indigo"
  | "magenta";

/** Volgorde van de kleurkiezer in de taak-sheet. */
export const TASK_COLORS: readonly TaskColor[] = [
  "coral",
  "amber",
  "lime",
  "mint",
  "teal",
  "sky",
  "indigo",
  "magenta",
];

// Bewust een type-alias (geen interface): alleen type-aliassen krijgen de
// impliciete index-signature die Supabase' GenericSchema-constraint
// (Record<string, unknown>) vereist. Met een interface valt het schema terug
// op `any` en verliezen we alle Row/Insert/Update-typing.
export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  date: string | null; // ISO-datum (YYYY-MM-DD), null bij inbox
  start_time: string | null; // HH:MM(:SS), null bij inbox
  duration_minutes: number | null;
  color: TaskColor;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

/** Velden die de client mag aanleveren bij het aanmaken van een taak. */
export type TaskInsert = Pick<Task, "title"> &
  Partial<
    Pick<
      Task,
      | "notes"
      | "status"
      | "date"
      | "start_time"
      | "duration_minutes"
      | "color"
      | "completed"
    >
  >;

/** Velden die bij een update gewijzigd mogen worden. */
export type TaskUpdate = Partial<Omit<TaskInsert, "title">> &
  Partial<Pick<Task, "title">>;

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: TaskInsert & { user_id: string };
        Update: TaskUpdate;
        Relationships: [];
      };
    };
    // Leeg maar aanwezig zodat het schema aan Supabase' GenericSchema voldoet
    // en de client-types (Row/Insert/Update) strikt afgeleid worden.
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
}
