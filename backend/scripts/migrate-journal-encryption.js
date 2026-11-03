const { pool } = require("../config/db");
const { encryptField, isEncrypted, decryptField, validateEncryptionKeyOnStartup } = require("../services/journal-encryption.service");

/**
 * Controlled, resumable migration script to encrypt existing plaintext journal data in Supabase.
 * - Processes records in manageable batches
 * - Verifies decryption round-trip before updating
 * - Safe to re-run or resume if interrupted
 * - Preserves relationships and metadata
 * - Avoids logging sensitive content
 */

async function migrateJournalData() {
  console.log("=== STARTING APPLICATION-LEVEL JOURNAL ENCRYPTION MIGRATION ===");
  validateEncryptionKeyOnStartup();

  const client = await pool.connect();
  try {
    // 1. Migrate journal_entry_messages.message_text
    console.log("\n--- 1. Checking journal_entry_messages ---");
    let totalMessagesMigrated = 0;
    let messageBatch = 0;

    while (true) {
      const messagesRes = await client.query(
        `select id, entry_id, message_text
         from public.journal_entry_messages
         where message_text is not null
           and message_text not like 'v1:%'
         order by id asc
         limit 100`
      );

      if (messagesRes.rows.length === 0) {
        console.log("No unencrypted journal messages remaining.");
        break;
      }

      messageBatch++;
      console.log(`Processing message batch ${messageBatch} (${messagesRes.rows.length} records)...`);

      for (const row of messagesRes.rows) {
        const plaintext = row.message_text;
        if (!plaintext || isEncrypted(plaintext)) continue;

        const ctx = { table: "journal_entry_messages", column: "message_text", id: row.id };
        const ciphertext = encryptField(plaintext, ctx);

        // Verification check before storing
        const decrypted = decryptField(ciphertext, ctx);
        if (decrypted !== plaintext) {
          throw new Error(`Verification failed for message ${row.id}: round-trip mismatch!`);
        }

        await client.query(
          "update public.journal_entry_messages set message_text = $1 where id = $2",
          [ciphertext, row.id]
        );
        totalMessagesMigrated++;
      }
    }
    console.log(`Total journal_entry_messages encrypted: ${totalMessagesMigrated}`);

    // 2. Migrate journal_entries (title, summary, admin_flag_reason, insights)
    console.log("\n--- 2. Checking journal_entries ---");
    let totalEntriesMigrated = 0;
    let entryBatch = 0;

    while (true) {
      const entriesRes = await client.query(
        `select id, title, summary, admin_flag_reason, insights
         from public.journal_entries
         where (title is not null and title not like 'v1:%')
            or (summary is not null and summary not like 'v1:%')
            or (admin_flag_reason is not null and admin_flag_reason not like 'v1:%')
         order by id asc
         limit 100`
      );

      if (entriesRes.rows.length === 0) {
        console.log("No unencrypted journal entries remaining.");
        break;
      }

      entryBatch++;
      console.log(`Processing entry batch ${entryBatch} (${entriesRes.rows.length} records)...`);

      for (const row of entriesRes.rows) {
        let encTitle = row.title;
        if (row.title && !isEncrypted(row.title)) {
          const ctx = { table: "journal_entries", column: "title", id: row.id };
          encTitle = encryptField(row.title, ctx);
          if (decryptField(encTitle, ctx) !== row.title) {
            throw new Error(`Verification failed for entry ${row.id} title!`);
          }
        }

        let encSummary = row.summary;
        if (row.summary && !isEncrypted(row.summary)) {
          const ctx = { table: "journal_entries", column: "summary", id: row.id };
          encSummary = encryptField(row.summary, ctx);
          if (decryptField(encSummary, ctx) !== row.summary) {
            throw new Error(`Verification failed for entry ${row.id} summary!`);
          }
        }

        let encFlagReason = row.admin_flag_reason;
        if (row.admin_flag_reason && !isEncrypted(row.admin_flag_reason)) {
          const ctx = { table: "journal_entries", column: "admin_flag_reason", id: row.id };
          encFlagReason = encryptField(row.admin_flag_reason, ctx);
          if (decryptField(encFlagReason, ctx) !== row.admin_flag_reason) {
            throw new Error(`Verification failed for entry ${row.id} admin_flag_reason!`);
          }
        }

        let encInsights = row.insights;
        if (Array.isArray(row.insights)) {
          encInsights = row.insights.map((ins, idx) => {
            if (ins && !isEncrypted(ins)) {
              const ctx = { table: "journal_entries", column: "insights_" + idx, id: row.id };
              const enc = encryptField(ins, ctx);
              if (decryptField(enc, ctx) !== ins) {
                throw new Error(`Verification failed for entry ${row.id} insights_${idx}!`);
              }
              return enc;
            }
            return ins;
          });
        }

        await client.query(
          `update public.journal_entries
           set title = $1, summary = $2, admin_flag_reason = $3, insights = $4::jsonb, updated_at = updated_at
           where id = $5`,
          [encTitle, encSummary, encFlagReason, JSON.stringify(encInsights || []), row.id]
        );
        totalEntriesMigrated++;
      }
    }
    console.log(`Total journal_entries encrypted: ${totalEntriesMigrated}`);

    // 3. Post-migration verification audit
    console.log("\n--- 3. Running Post-Migration Verification Audit ---");
    const unencryptedMessages = await client.query(
      "select count(*)::int as count from public.journal_entry_messages where message_text is not null and message_text not like 'v1:%'"
    );
    const unencryptedEntries = await client.query(
      `select count(*)::int as count from public.journal_entries
       where (title is not null and title not like 'v1:%' and title <> '')
          or (summary is not null and summary not like 'v1:%' and summary <> '')
          or (admin_flag_reason is not null and admin_flag_reason not like 'v1:%' and admin_flag_reason <> '')`
    );

    console.log("Unencrypted messages count:", unencryptedMessages.rows[0].count);
    console.log("Unencrypted entries count:", unencryptedEntries.rows[0].count);

    if (unencryptedMessages.rows[0].count === 0 && unencryptedEntries.rows[0].count === 0) {
      console.log("\nSUCCESS: All targeted database columns are fully encrypted with AES-256-GCM!");
    } else {
      console.warn("\nWARNING: Some records could not be verified as encrypted.");
    }

  } finally {
    client.release();
  }
}

if (require.main === module) {
  require("dotenv").config({ path: "backend/.env" });
  migrateJournalData()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}

module.exports = { migrateJournalData };
