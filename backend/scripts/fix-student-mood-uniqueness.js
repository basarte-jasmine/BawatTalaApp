require("dotenv").config();

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("No database URL is configured.");
  process.exit(1);
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const before = await pool.query(`
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'student_moods'
      and constraint_type = 'UNIQUE'
    order by constraint_name
  `);

  console.log("Unique constraints before:", before.rows.map((row) => row.constraint_name));

  const legacyConstraints = await pool.query(`
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
  `);

  for (const row of legacyConstraints.rows) {
    console.log(`Dropping constraint: ${row.constraint_name}`);
    await pool.query(`alter table public.student_moods drop constraint if exists ${quoteIdentifier(row.constraint_name)}`);
  }

  for (const name of ["student_moods_student_date_unique", "student_moods_student_number_mood_date_key"]) {
    await pool.query(`alter table public.student_moods drop constraint if exists ${quoteIdentifier(name)}`);
    await pool.query(`drop index if exists public.${quoteIdentifier(name)}`);
  }

  const legacyIndexes = await pool.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'student_moods'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
      and indexdef ilike '%(student_number, mood_date)%'
  `);

  for (const row of legacyIndexes.rows) {
    console.log(`Dropping index: ${row.indexname}`);
    await pool.query(`drop index if exists public.${quoteIdentifier(row.indexname)}`);
  }

  await pool.query(`
    create index if not exists student_moods_student_date_created_idx
      on public.student_moods (student_number, mood_date, created_at desc)
  `);

  const existingStudent = await pool.query(`
    select student_number
    from public.student_moods
    where student_number is not null
    limit 1
  `);

  if (existingStudent.rows[0]?.student_number) {
    const studentNumber = existingStudent.rows[0].student_number;
    await pool.query("begin");
    try {
      await pool.query(
        `
          insert into public.student_moods (student_number, mood_id, mood_label, mood_date)
          values
            ($1, 'calm', 'Calm', '2099-01-01'::date),
            ($1, 'happy', 'Happy', '2099-01-01'::date)
        `,
        [studentNumber],
      );
      const verification = await pool.query(
        `
          select count(*)::int as check_in_count
          from public.student_moods
          where student_number = $1
            and mood_date = '2099-01-01'::date
        `,
        [studentNumber],
      );
      console.log("Rollback-only duplicate insert verification:", verification.rows[0].check_in_count);
    } finally {
      await pool.query("rollback");
    }
  } else {
    console.log("Skipped duplicate insert verification: no existing student mood rows found.");
  }

  const after = await pool.query(`
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'student_moods'
      and constraint_type = 'UNIQUE'
    order by constraint_name
  `);

  console.log("Unique constraints after:", after.rows.map((row) => row.constraint_name));
  console.log("student_moods can now store multiple emotion check-ins per student per day.");
}

main()
  .catch((error) => {
    console.error(error.code || "", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
