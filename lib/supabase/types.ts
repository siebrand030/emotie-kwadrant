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

export type TaskColor = "coral" | "amber" | "mint" | "sky" | "violet";

export interface Task {
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
}

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

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: TaskInsert & { user_id: string };
        Update: TaskUpdate;
      };
    };
  };
}
