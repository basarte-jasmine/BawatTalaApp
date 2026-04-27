const { Pool } = require("pg");
const { JOURNAL_TAG_OPTIONS } = require("../constants/journal-tags");

const LEGACY_JOURNAL_CONCERN_VALUES = [
  "Academic Stress",
  "Anxiety / Stress",
  "Relationships",
  "Family Issues",
  "Career Guidance",
  "Financial Concerns",
  "Burnout / Exhaustion",
  "Bullying",
  "Others",
];

const JOURNAL_PRIMARY_CONCERN_VALUES = [
  ...JOURNAL_TAG_OPTIONS,
  ...LEGACY_JOURNAL_CONCERN_VALUES,
].filter((value, index, values) => values.indexOf(value) === index);

const LEGACY_DAILY_MOOD_UNIQUE_NAMES = [
  "student_moods_student_date_unique",
  "student_moods_student_number_mood_date_key",
];

function toSqlTextList(values) {
  return values
    .map((value) => `'${String(value).replace(/'/g, "''")}'`)
    .join(",\n        ");
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function withDatabaseErrorDetails(friendlyError, originalError) {
  if (!originalError) return friendlyError;

  for (const key of ["code", "constraint", "detail", "schema", "table"]) {
    if (originalError[key]) {
      friendlyError[key] = originalError[key];
    }
  }

  return friendlyError;
}

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.SUPABASE_DB_URL,
    process.env.POSTGRES_URL,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  const host = String(process.env.DB_HOST || "").trim();
  const port = String(process.env.DB_PORT || "5432").trim();
  const database = String(process.env.DB_NAME || "").trim();
  const user = String(process.env.DB_USER || "").trim();
  const password = String(process.env.DB_PASSWORD || "").trim();

  if (host && database && user && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return "";
}

function describeDatabaseTarget(connectionString) {
  if (!connectionString) return "not configured";
  try {
    const parsed = new URL(connectionString);
    return parsed.hostname || "unknown host";
  } catch {
    return "invalid connection string";
  }
}

function toFriendlyDatabaseError(error, connectionString) {
  if (!error) return new Error("Database connection failed.");

  const host = describeDatabaseTarget(connectionString);
  if (error.code === "ENOTFOUND") {
    return withDatabaseErrorDetails(
      new Error(`Database host could not be resolved: ${host}. Check your DATABASE_URL or SUPABASE_DB_URL value.`),
      error,
    );
  }

  if (error.code === "ECONNREFUSED") {
    return withDatabaseErrorDetails(
      new Error(`Database connection was refused by ${host}. Check that the database is reachable and your port is correct.`),
      error,
    );
  }

  if (error.code === "28P01") {
    return withDatabaseErrorDetails(
      new Error("Database login failed. Check your database username and password."),
      error,
    );
  }

  if (error.code === "3D000") {
    return withDatabaseErrorDetails(
      new Error("Database does not exist. Check the database name in your connection settings."),
      error,
    );
  }

  if (error.code === "SELF_SIGNED_CERT_IN_CHAIN") {
    return withDatabaseErrorDetails(
      new Error("Database SSL verification failed. Check the SSL settings for your database connection."),
      error,
    );
  }

  return withDatabaseErrorDetails(new Error(error.message || "Database connection failed."), error);
}

const databaseUrl = resolveDatabaseUrl();

let pool = null;
if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
}

async function removeLegacyDailyMoodUniqueness() {
  const legacyConstraints = await query(`
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'student_moods'
      and constraint_type = 'UNIQUE'
      and constraint_name in (
        select tc.constraint_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_schema = kcu.constraint_schema
          and tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
          and tc.table_name = kcu.table_name
        where tc.table_schema = 'public'
          and tc.table_name = 'student_moods'
          and tc.constraint_type = 'UNIQUE'
        group by tc.constraint_name
        having array_agg(kcu.column_name::text order by kcu.ordinal_position) = array['student_number', 'mood_date']
      )
  `);

  for (const row of legacyConstraints.rows) {
    await query(`alter table public.student_moods drop constraint if exists ${quoteIdentifier(row.constraint_name)}`);
  }

  for (const name of LEGACY_DAILY_MOOD_UNIQUE_NAMES) {
    await query(`alter table public.student_moods drop constraint if exists ${quoteIdentifier(name)}`);
  }

  const legacyIndexes = await query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'student_moods'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
      and indexdef ilike '%(student_number, mood_date)%'
  `);

  for (const row of legacyIndexes.rows) {
    await query(`drop index if exists public.${quoteIdentifier(row.indexname)}`);
  }

  for (const name of LEGACY_DAILY_MOOD_UNIQUE_NAMES) {
    await query(`drop index if exists public.${quoteIdentifier(name)}`);
  }
}

async function ensureDatabaseSchema() {
  if (!pool) return;

  try {
    await pool.query(`create extension if not exists pgcrypto;`);
  } catch (error) {
    throw toFriendlyDatabaseError(error, databaseUrl);
  }

  await pool.query(`
    create table if not exists public.admin_accounts (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      password_hash text not null,
      full_name text,
      role text not null default 'COUNSELOR',
      gender text,
      profile_picture_url text,
      specialties jsonb not null default '[]'::jsonb,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists full_name text;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists role text not null default 'COUNSELOR';
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists gender text;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists profile_picture_url text;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists specialties jsonb not null default '[]'::jsonb;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add column if not exists settings jsonb not null default '{}'::jsonb;
  `);

  await pool.query(`
    alter table public.admin_accounts
    drop constraint if exists admin_accounts_role_check;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add constraint admin_accounts_role_check
    check (role in ('HEAD_COUNSELOR', 'COUNSELOR'));
  `);

  await pool.query(`
    alter table public.admin_accounts
    drop constraint if exists admin_accounts_gender_check;
  `);

  await pool.query(`
    alter table public.admin_accounts
    add constraint admin_accounts_gender_check
    check (
      gender is null
      or gender in ('Male', 'Female', 'Prefer not to say')
    );
  `);

  await pool.query(`
    create table if not exists public.student_moods (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      mood_id text not null,
      mood_label text not null,
      mood_date date not null,
      mood_source text not null default 'INPUT',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint student_moods_mood_source_check check (mood_source in ('INPUT', 'JOURNAL'))
    );
  `);

  await pool.query(`
    alter table public.student_moods
    add column if not exists mood_source text not null default 'INPUT';
  `);

  await pool.query(`
    update public.student_moods
    set mood_source = 'INPUT'
    where mood_source is null
      or mood_source not in ('INPUT', 'JOURNAL');
  `);

  await pool.query(`
    alter table public.student_moods
    drop constraint if exists student_moods_mood_source_check;
  `);

  await pool.query(`
    alter table public.student_moods
    add constraint student_moods_mood_source_check
    check (mood_source in ('INPUT', 'JOURNAL'));
  `);

  await removeLegacyDailyMoodUniqueness();

  await pool.query(`
    create index if not exists student_moods_student_date_created_idx
      on public.student_moods (student_number, mood_date, created_at desc);
  `);

  await pool.query(`
    create table if not exists public.student_tala_wallets (
      id uuid primary key default gen_random_uuid(),
      student_number text not null unique,
      total_tala integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists public.student_daily_checkins (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      check_in_date date not null,
      cycle_day integer not null,
      base_reward integer not null,
      bonus_reward integer not null default 0,
      total_reward integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint student_daily_checkins_student_date_unique unique (student_number, check_in_date)
    );
  `);

  await pool.query(`
    create table if not exists public.journal_entries (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      entry_date date not null,
      title text,
      summary text,
      insights jsonb not null default '[]'::jsonb,
      risk_level text not null default 'NONE',
      admin_flag_reason text,
      ai_enabled boolean not null default true,
      is_finished boolean not null default false,
      finished_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists is_finished boolean not null default false;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists finished_at timestamptz;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists support_prompt_shown_at timestamptz;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists support_response text;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists support_response_at timestamptz;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists summary_rating text;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists summary_rated_at timestamptz;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists deleted_by_student_at timestamptz;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists primary_concern text;
  `);

  await pool.query(`
    alter table public.journal_entries
    add column if not exists concern_tags jsonb not null default '[]'::jsonb;
  `);

  await pool.query(`
    alter table public.journal_entries
    drop constraint if exists journal_entries_support_response_check;
  `);

  await pool.query(`
    alter table public.journal_entries
    add constraint journal_entries_support_response_check
    check (
      support_response is null
      or support_response in ('CONTACTED', 'DECLINED')
    );
  `);

  await pool.query(`
    alter table public.journal_entries
    drop constraint if exists journal_entries_primary_concern_check;
  `);

  await pool.query(`
    alter table public.journal_entries
    add constraint journal_entries_primary_concern_check
    check (
      primary_concern is null
      or primary_concern in (
        ${toSqlTextList(JOURNAL_PRIMARY_CONCERN_VALUES)}
      )
    );
  `);

  await pool.query(`
    alter table public.journal_entries
    drop constraint if exists journal_entries_student_date_unique;
  `);

  await pool.query(`
    create table if not exists public.journal_entry_messages (
      id uuid primary key default gen_random_uuid(),
      entry_id uuid not null references public.journal_entries(id) on delete cascade,
      student_number text not null,
      role text not null,
      message_text text not null,
      created_at timestamptz not null default now(),
      constraint journal_entry_messages_role_check check (role in ('user', 'assistant'))
    );
  `);

  await pool.query(`
    create index if not exists journal_entries_student_number_idx
      on public.journal_entries (student_number);
  `);

  await pool.query(`
    create index if not exists journal_entries_entry_date_idx
      on public.journal_entries (entry_date);
  `);

  await pool.query(`
    create index if not exists journal_entries_risk_level_idx
      on public.journal_entries (risk_level);
  `);

  await pool.query(`
    create index if not exists journal_entry_messages_entry_id_idx
      on public.journal_entry_messages (entry_id, created_at);
  `);

  await pool.query(`
    create table if not exists public.counselor_availability (
      id uuid primary key default gen_random_uuid(),
      counselor_id uuid not null references public.admin_accounts(id) on delete cascade,
      day_of_week integer,
      override_date date,
      slot_time text not null,
      is_enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint counselor_availability_day_of_week_check check (day_of_week is null or day_of_week between 0 and 6),
      constraint counselor_availability_scope_check check (
        (override_date is null and day_of_week is not null)
        or (override_date is not null)
      )
    );
  `);

  await pool.query(`
    alter table public.counselor_availability
    add column if not exists override_date date;
  `);

  await pool.query(`
    alter table public.counselor_availability
    alter column day_of_week drop not null;
  `);

  await pool.query(`
    alter table public.counselor_availability
    drop constraint if exists counselor_availability_unique;
  `);

  await pool.query(`
    alter table public.counselor_availability
    drop constraint if exists counselor_availability_day_of_week_check;
  `);

  await pool.query(`
    alter table public.counselor_availability
    add constraint counselor_availability_day_of_week_check
    check (day_of_week is null or day_of_week between 0 and 6);
  `);

  await pool.query(`
    alter table public.counselor_availability
    drop constraint if exists counselor_availability_scope_check;
  `);

  await pool.query(`
    alter table public.counselor_availability
    add constraint counselor_availability_scope_check
    check (
      (override_date is null and day_of_week is not null)
      or (override_date is not null)
    );
  `);

  await pool.query(`
    create table if not exists public.counselor_appointments (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      counselor_id uuid not null references public.admin_accounts(id) on delete restrict,
      concern text not null,
      appointment_date date not null,
      slot_time text not null,
      status text not null default 'CONFIRMED',
      student_note text,
      counselor_gender_preference text,
      booking_source text not null default 'MOBILE_APP',
      created_by_admin_email text,
      appointment_reminder_sent_at timestamptz,
      admin_appointment_reminder_sent_at timestamptz,
      pending_expiry_warning_sent_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint counselor_appointments_status_check check (status in ('PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED')),
      constraint counselor_appointments_booking_source_check check (booking_source in ('MOBILE_APP', 'ADMIN_PANEL')),
      constraint counselor_appointments_gender_preference_check check (
        counselor_gender_preference is null
        or counselor_gender_preference in ('No Preference', 'Female Counselor', 'Male Counselor')
      )
    );
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add column if not exists booking_source text not null default 'MOBILE_APP';
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add column if not exists created_by_admin_email text;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add column if not exists appointment_reminder_sent_at timestamptz;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add column if not exists admin_appointment_reminder_sent_at timestamptz;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add column if not exists pending_expiry_warning_sent_at timestamptz;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    drop constraint if exists counselor_appointments_status_check;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add constraint counselor_appointments_status_check
    check (status in ('PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED'));
  `);

  await pool.query(`
    alter table public.counselor_appointments
    drop constraint if exists counselor_appointments_booking_source_check;
  `);

  await pool.query(`
    alter table public.counselor_appointments
    add constraint counselor_appointments_booking_source_check
    check (booking_source in ('MOBILE_APP', 'ADMIN_PANEL'));
  `);

  await pool.query(`
    create table if not exists public.admin_activity_logs (
      id uuid primary key default gen_random_uuid(),
      actor_email text,
      actor_name text,
      actor_role text,
      action_type text not null,
      entity_type text not null,
      title text not null,
      description text not null default '',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists public.admin_notifications (
      id uuid primary key default gen_random_uuid(),
      admin_email text not null,
      kind text not null,
      title text not null,
      message text not null,
      metadata jsonb not null default '{}'::jsonb,
      is_read boolean not null default false,
      read_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists public.student_notifications (
      id uuid primary key default gen_random_uuid(),
      student_number text not null,
      kind text not null,
      title text not null,
      message text not null,
      metadata jsonb not null default '{}'::jsonb,
      is_read boolean not null default false,
      read_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table public.student_notifications
    add column if not exists deleted_at timestamptz;
  `);

  await pool.query(`
    alter table public.admin_notifications
    add column if not exists deleted_at timestamptz;
  `);

  await pool.query(`
    create index if not exists counselor_availability_counselor_idx
      on public.counselor_availability (counselor_id, day_of_week, slot_time);
  `);

  await pool.query(`
    create index if not exists counselor_availability_override_date_idx
      on public.counselor_availability (counselor_id, override_date, slot_time);
  `);

  await pool.query(`
    create unique index if not exists counselor_availability_weekly_unique_idx
      on public.counselor_availability (counselor_id, day_of_week, slot_time)
      where override_date is null;
  `);

  await pool.query(`
    create unique index if not exists counselor_availability_date_override_unique_idx
      on public.counselor_availability (counselor_id, override_date, slot_time)
      where override_date is not null;
  `);

  await pool.query(`
    create index if not exists counselor_appointments_date_idx
      on public.counselor_appointments (appointment_date, slot_time);
  `);

  await pool.query(`
    create index if not exists counselor_appointments_student_idx
      on public.counselor_appointments (student_number, appointment_date);
  `);

  await pool.query(`
    create index if not exists admin_activity_logs_created_at_idx
      on public.admin_activity_logs (created_at desc);
  `);

  await pool.query(`
    create index if not exists admin_notifications_email_created_at_idx
      on public.admin_notifications (admin_email, created_at desc);
  `);

  await pool.query(`
    create index if not exists student_notifications_student_created_at_idx
      on public.student_notifications (student_number, created_at desc);
  `);
}

async function query(text, params = []) {
  if (!pool) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL, SUPABASE_DB_URL, POSTGRES_URL, or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }
  try {
    return await pool.query(text, params);
  } catch (error) {
    throw toFriendlyDatabaseError(error, databaseUrl);
  }
}

module.exports = {
  dbPool: pool,
  ensureDatabaseSchema,
  query,
  removeLegacyDailyMoodUniqueness,
};
