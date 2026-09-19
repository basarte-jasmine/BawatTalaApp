
require('dotenv').config();
const { query } = require('./src/config/db');

async function clearAll() {
  try {
    console.log("Clearing all for 23-3038...");
    await query("DELETE FROM public.student_achievements WHERE student_number = $1", ["23-3038"]);
    await query("DELETE FROM public.student_notifications WHERE student_number = $1 AND kind LIKE '%ACHIEVEMENT%'", ["23-3038"]);
    await query("DELETE FROM public.student_muni_purchases WHERE student_number = $1", ["23-3038"]);
    console.log("Cleared everything!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

clearAll();

