/**
 * Durable login lockout storage (Postgres).
 * Replaces in-memory Maps so lockouts survive process restarts.
 */
"use strict";

const { query } = require("../config/db");

async function getLoginLockout(scope, lockKey) {
  const result = await query(
    `
      select failed_count, lock_until
      from public.auth_login_lockouts
      where scope = $1 and lock_key = $2
      limit 1
    `,
    [scope, lockKey],
  );
  const row = result.rows?.[0];
  if (!row) return { count: 0, lockUntil: 0 };
  const lockUntil = row.lock_until ? new Date(row.lock_until).getTime() : 0;
  const now = Date.now();
  if (lockUntil && now >= lockUntil) {
    // expired lock - clear for next attempts
    await clearLoginLockout(scope, lockKey);
    return { count: 0, lockUntil: 0 };
  }
  return {
    count: Number(row.failed_count || 0),
    lockUntil,
  };
}

async function registerFailedLoginAttempt(scope, lockKey, { limit, lockDurationMs }) {
  const now = Date.now();
  const current = await getLoginLockout(scope, lockKey);
  if (current.lockUntil && now < current.lockUntil) {
    return { locked: true, lockUntil: current.lockUntil, count: current.count };
  }

  const updatedCount = current.count + 1;
  if (updatedCount >= limit) {
    const lockUntil = now + lockDurationMs;
    await query(
      `
        insert into public.auth_login_lockouts (scope, lock_key, failed_count, lock_until, updated_at)
        values ($1, $2, 0, to_timestamp($3 / 1000.0), now())
        on conflict (scope, lock_key) do update
          set failed_count = 0,
              lock_until = excluded.lock_until,
              updated_at = now()
      `,
      [scope, lockKey, lockUntil],
    );
    return { locked: true, lockUntil, count: 0 };
  }

  await query(
    `
      insert into public.auth_login_lockouts (scope, lock_key, failed_count, lock_until, updated_at)
      values ($1, $2, $3, null, now())
      on conflict (scope, lock_key) do update
        set failed_count = excluded.failed_count,
            lock_until = null,
            updated_at = now()
    `,
    [scope, lockKey, updatedCount],
  );
  return { locked: false, lockUntil: 0, count: updatedCount };
}

async function clearLoginLockout(scope, lockKey) {
  await query(
    `delete from public.auth_login_lockouts where scope = $1 and lock_key = $2`,
    [scope, lockKey],
  );
}

module.exports = {
  getLoginLockout,
  registerFailedLoginAttempt,
  clearLoginLockout,
};
