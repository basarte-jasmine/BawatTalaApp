require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { query } = require("./src/config/db");

(async () => {
  const sn = "23-9876";
  const statements = [
    "delete from public.journal_entry_messages where student_number = $1",
    "delete from public.journal_entries where student_number = $1",
    "delete from public.student_moods where student_number = $1",
    "delete from public.counselor_appointments where student_number = $1",
    "delete from public.student_feedbacks where student_number = $1",
    "delete from public.student_daily_checkins where student_number = $1",
    "delete from public.student_library_progress where student_number = $1",
    "delete from public.student_library_downloads where student_number = $1",
    "delete from public.student_library_reading_rewards where student_number = $1",
    "delete from public.student_tala_wallets where student_number = $1",
    "delete from public.student_muni_wardrobes where student_number = $1",
    "delete from public.student_muni_purchases where student_number = $1",
    "delete from public.future_self_messages where student_number = $1",
    "delete from public.student_notifications where student_number = $1",
    "delete from public.student_referrals where student_number = $1 or referred_by_student_number = $1",
    "delete from public.student_app_preferences where student_number = $1",
    "delete from public.peer_counselors where student_number = $1",
    "delete from public.student_profiles where student_number = $1",
  ];

  for (const statement of statements) {
    try {
      const r = await query(statement, [sn]);
      console.log("OK", statement.split(" from ")[1].split(" where ")[0], "rows", r.rowCount);
    } catch (e) {
      console.log("FAIL", statement.split(" from ")[1].split(" where ")[0], e.code, e.message);
      throw e;
    }
  }

  const left = await query("select student_number from public.student_profiles where student_number = $1", [sn]);
  console.log("remaining profile", left.rows);
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e.code, e.message, e.detail || "");
  process.exit(1);
});
