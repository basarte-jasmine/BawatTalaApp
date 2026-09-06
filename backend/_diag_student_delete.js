require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { query } = require("./src/config/db");

(async () => {
  const sn = "23-9876";
  const fks = await query(`
    select tc.table_name, kcu.column_name, ccu.table_name as foreign_table, ccu.column_name as foreign_column, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
      and (
        ccu.table_name = 'student_profiles'
        or ccu.column_name = 'student_number'
        or kcu.column_name ilike '%student%'
      )
    order by tc.table_name, kcu.column_name
  `);
  console.log("FKs count", fks.rows.length);
  for (const row of fks.rows) {
    console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table}.${row.foreign_column} [${row.delete_rule}]`);
  }

  const cols = await query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema='public' and (
      column_name = 'student_number'
      or column_name = 'referred_by_student_number'
    )
    order by table_name, column_name
  `);
  console.log("\nTables with student_number:");
  for (const row of cols.rows) console.log(`- ${row.table_name}.${row.column_name}`);

  const profile = await query(
    "select student_number, full_name from public.student_profiles where upper(student_number) = upper($1)",
    [sn],
  );
  console.log("\nprofile", profile.rows);

  const probes = [
    "journal_entry_messages",
    "journal_entries",
    "student_moods",
    "counselor_appointments",
    "student_feedbacks",
    "student_daily_checkins",
    "student_library_progress",
    "student_library_downloads",
    "student_library_reading_rewards",
    "student_tala_wallets",
    "student_muni_wardrobes",
    "student_muni_purchases",
    "future_self_messages",
    "student_notifications",
    "student_referrals",
    "student_app_preferences",
  ];
  for (const table of probes) {
    try {
      const r = await query(`select count(*)::int as n from public.${table} where student_number = $1`, [sn]);
      console.log(`count ${table}: ${r.rows[0].n}`);
    } catch (e) {
      console.log(`count ${table}: ERR ${e.code || ""} ${e.message}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e.code, e.message);
  process.exit(1);
});
