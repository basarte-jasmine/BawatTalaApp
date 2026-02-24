const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || "";

let pool = null;
if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
}

async function ensureDatabaseSchema() {
  if (!pool) return;

  await pool.query(`create extension if not exists pgcrypto;`);

  await pool.query(`
    create table if not exists public.admin_accounts (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      password_hash text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is missing.");
  }
  return pool.query(text, params);
}

module.exports = {
  dbPool: pool,
  ensureDatabaseSchema,
  query,
};
