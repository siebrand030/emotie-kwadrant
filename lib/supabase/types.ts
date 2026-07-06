/**
 * Handmatig datamodel voor de `tasks`- en `checkins`-tabellen. Vervang dit
 * later door de gegenereerde types (`supabase gen types typescript`).
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

// --- Emotie-logger: `checkins` ---

/** Kwadrant-key uit de emotie-logger (labels: Beuken/Bouwen/Wegkwijnen/Ontspannen). */
export type Quadrant = "forceren" | "bouwen" | "wegzakken" | "opladen";

/** De 6 factoren (laag 3), elk 1-5 of null (= niet ingesteld). */
export type FactorKey =
  | "slaap"
  | "stress"
  | "eten"
  | "wiet"
  | "alcohol"
  | "planning";

export type Checkin = {
  id: string;
  user_id: string;
  quadrant: Quadrant;
  emotion: string;
  logged_at: string; // ISO timestamptz (moment van loggen)
  factor_slaap: number | null;
  factor_stress: number | null;
  factor_eten: number | null;
  factor_wiet: number | null;
  factor_alcohol: number | null;
  factor_planning: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Velden die de client mag aanleveren bij het aanmaken van een check-in. */
export type CheckinInsert = Pick<Checkin, "quadrant" | "emotion"> &
  Partial<
    Pick<
      Checkin,
      | "logged_at"
      | "factor_slaap"
      | "factor_stress"
      | "factor_eten"
      | "factor_wiet"
      | "factor_alcohol"
      | "factor_planning"
      | "note"
    >
  >;

/** Velden die bij een update gewijzigd mogen worden. */
export type CheckinUpdate = Partial<CheckinInsert>;

// --- Habits-module: `habits`, `habit_logs`, `habit_metrics` ---

export type HabitScheduleType = "daily" | "weekly_count";

export type HabitLogStatus = "done" | "skipped";

export type SkipReason =
  | "geen_tijd"
  | "vergeten"
  | "pijn_of_moe"
  | "geen_zin"
  | "niet_van_toepassing"
  | "anders";

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  schedule_type: HabitScheduleType;
  weekly_target: number | null; // alleen bij 'weekly_count'
  track_metric: boolean;
  metric_label: string | null;
  metric_prompt_interval_days: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HabitInsert = Pick<Habit, "name" | "schedule_type"> &
  Partial<
    Pick<
      Habit,
      | "description"
      | "weekly_target"
      | "track_metric"
      | "metric_label"
      | "metric_prompt_interval_days"
      | "sort_order"
      | "is_active"
    >
  >;

export type HabitUpdate = Partial<HabitInsert>;

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  status: HabitLogStatus;
  skip_reason: SkipReason | null;
  note: string | null;
  created_at: string;
};

export type HabitLogInsert = Pick<HabitLog, "habit_id" | "log_date" | "status"> &
  Partial<Pick<HabitLog, "skip_reason" | "note">>;

export type HabitLogUpdate = Partial<Omit<HabitLogInsert, "habit_id" | "log_date">>;

export type HabitMetric = {
  id: string;
  habit_id: string;
  user_id: string;
  measured_on: string; // YYYY-MM-DD
  value: number;
  created_at: string;
};

export type HabitMetricInsert = Pick<HabitMetric, "habit_id" | "measured_on" | "value">;

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: TaskInsert & { user_id: string };
        Update: TaskUpdate;
        Relationships: [];
      };
      checkins: {
        Row: Checkin;
        Insert: CheckinInsert & { user_id: string };
        Update: CheckinUpdate;
        Relationships: [];
      };
      habits: {
        Row: Habit;
        Insert: HabitInsert & { user_id: string };
        Update: HabitUpdate;
        Relationships: [];
      };
      habit_logs: {
        Row: HabitLog;
        Insert: HabitLogInsert & { user_id: string };
        Update: HabitLogUpdate;
        Relationships: [];
      };
      habit_metrics: {
        Row: HabitMetric;
        Insert: HabitMetricInsert & { user_id: string };
        Update: Partial<HabitMetricInsert>;
        Relationships: [];
      };
    };
    // Leeg maar aanwezig zodat het schema aan Supabase' GenericSchema voldoet
    // en de client-types (Row/Insert/Update) strikt afgeleid worden.
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
}
