const express = require("express");
const { dbPool, query } = require("../config/db");
const { requireStudentOnlyAuth } = require("../middleware/auth.middleware");
const {
  DEFAULT_LOADOUT,
  MUNI_CATALOG,
  SECTION_IDS,
  collectRemovedOwnedItemIds,
  createStarterOwnedItems,
  getCatalogItem,
  getRemovedPaidItemPrice,
  listRemovedPaidItemIds,
  normalizeLoadout,
  normalizeOwnedItems,
  restoreRemovedLoadoutSlots,
} = require("../constants/muni-catalog");

const router = express.Router();
router.use(requireStudentOnlyAuth);

const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function resolveStudentNumber(req) {
  const fromAuth = normalizeStudentNumber(req.student?.studentNumber || "");
  if (fromAuth && STUDENT_NUMBER_PATTERN.test(fromAuth)) {
    return fromAuth;
  }
  return "";
}

function serializeWardrobe(row, totalTala) {
  const ownedItems = normalizeOwnedItems(row?.owned_items);
  const loadout = normalizeLoadout(row?.loadout, ownedItems);
  return {
    catalog: MUNI_CATALOG,
    loadout,
    ownedItems,
    totalTala: Number(totalTala || 0),
  };
}

async function getWalletTotal(executor, studentNumber) {
  const result = await executor.query(
    `
      select total_tala
      from public.student_tala_wallets
      where student_number = $1
      limit 1
    `,
    [studentNumber],
  );
  return Number(result.rows[0]?.total_tala || 0);
}

async function refundRemovedPaidItems(executor, studentNumber, rawOwned) {
  const removedIds = listRemovedPaidItemIds();
  const purchaseResult = await executor.query(
    `
      select id, item_id, price_paid
      from public.student_muni_purchases
      where student_number = $1
        and item_id = any($2::text[])
      for update
    `,
    [studentNumber, removedIds],
  );

  let refund = 0;
  const refundedIds = new Set();
  for (const row of purchaseResult.rows) {
    const itemId = String(row.item_id || "").trim();
    refundedIds.add(itemId);
    const paid = Number(row.price_paid);
    const price = Number.isFinite(paid) && paid > 0 ? paid : getRemovedPaidItemPrice(itemId);
    refund += Math.max(0, price);
  }

  if (purchaseResult.rows.length > 0) {
    await executor.query(
      `
        delete from public.student_muni_purchases
        where student_number = $1
          and item_id = any($2::text[])
      `,
      [studentNumber, removedIds],
    );
  }

  const ownedRemoved = collectRemovedOwnedItemIds(rawOwned);
  for (const itemId of ownedRemoved) {
    if (!refundedIds.has(itemId)) {
      refundedIds.add(itemId);
      const price = getRemovedPaidItemPrice(itemId);
      refund += Math.max(0, price);
    }
  }

  if (refund > 0) {
    await executor.query(
      `
        insert into public.student_tala_wallets (student_number, total_tala, updated_at)
        values ($1, $2, now())
        on conflict (student_number)
        do update set
          total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
          updated_at = now()
      `,
      [studentNumber, refund],
    );
  }

  return refund;
}

async function ensureWardrobeRow(executor, studentNumber) {
  const existing = await executor.query(
    `
      select owned_items, loadout
      from public.student_muni_wardrobes
      where student_number = $1
      for update
    `,
    [studentNumber],
  );

  if (existing.rows[0]) {
    await refundRemovedPaidItems(executor, studentNumber, existing.rows[0].owned_items);
    const restoredLoadout = restoreRemovedLoadoutSlots(existing.rows[0].loadout);
    const ownedItems = normalizeOwnedItems(existing.rows[0].owned_items);
    const loadout = normalizeLoadout(restoredLoadout, ownedItems);
    if (
      JSON.stringify(ownedItems) !== JSON.stringify(existing.rows[0].owned_items) ||
      JSON.stringify(loadout) !== JSON.stringify(existing.rows[0].loadout)
    ) {
      await executor.query(
        `
          update public.student_muni_wardrobes
          set owned_items = $2::jsonb,
              loadout = $3::jsonb,
              updated_at = now()
          where student_number = $1
        `,
        [studentNumber, JSON.stringify(ownedItems), JSON.stringify(loadout)],
      );
    }
    return { owned_items: ownedItems, loadout };
}

  const ownedItems = createStarterOwnedItems();
  const loadout = { ...DEFAULT_LOADOUT };
  await executor.query(
    `
      insert into public.student_muni_wardrobes (
        student_number,
        owned_items,
        loadout,
        updated_at
      )
      values ($1, $2::jsonb, $3::jsonb, now())
    `,
    [studentNumber, JSON.stringify(ownedItems), JSON.stringify(loadout)],
  );
  return { owned_items: ownedItems, loadout };
}

async function withTransaction(work) {
  if (!dbPool) {
    throw new Error("Database is not configured.");
  }
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

router.get("/wardrobe", async (req, res) => {
  const studentNumber = resolveStudentNumber(req);
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  try {
    const result = await withTransaction(async (client) => {
      const wardrobe = await ensureWardrobeRow(client, studentNumber);
      const totalTala = await getWalletTotal(client, studentNumber);
      return serializeWardrobe(wardrobe, totalTala);
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load wardrobe." });
  }
});

router.post("/purchase", async (req, res) => {
  const studentNumber = resolveStudentNumber(req);
  const sectionId = String(req.body?.sectionId || "").trim();
  const itemId = String(req.body?.itemId || "").trim();

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  const item = getCatalogItem(sectionId, itemId);
  if (!item) {
    return res.status(400).json({ message: "Unknown wardrobe item." });
  }

  try {
    const result = await withTransaction(async (client) => {
      await client.query(
        `
          insert into public.student_tala_wallets (student_number, total_tala, updated_at)
          values ($1, 0, now())
          on conflict (student_number) do nothing
        `,
        [studentNumber],
      );

      const walletResult = await client.query(
        `
          select total_tala
          from public.student_tala_wallets
          where student_number = $1
          for update
        `,
        [studentNumber],
      );
      const totalTala = Number(walletResult.rows[0]?.total_tala || 0);
      const wardrobe = await ensureWardrobeRow(client, studentNumber);
      const ownedItems = normalizeOwnedItems(wardrobe.owned_items);

      if (ownedItems[sectionId].includes(itemId)) {
        const error = new Error("Item already owned.");
        error.statusCode = 409;
        error.payload = serializeWardrobe({ owned_items: ownedItems, loadout: wardrobe.loadout }, totalTala);
        throw error;
      }

      const price = Number(item.price || 0);
      if (price > 0 && totalTala < price) {
        const error = new Error("Not enough Tala.");
        error.statusCode = 400;
        error.payload = serializeWardrobe({ owned_items: ownedItems, loadout: wardrobe.loadout }, totalTala);
        throw error;
      }

      const nextOwned = {
        ...ownedItems,
        [sectionId]: [...ownedItems[sectionId], itemId],
      };
      const nextTala = Math.max(0, totalTala - price);

      if (price > 0) {
        await client.query(
          `
            update public.student_tala_wallets
            set total_tala = $2,
                updated_at = now()
            where student_number = $1
          `,
          [studentNumber, nextTala],
        );
      }

      await client.query(
        `
          insert into public.student_muni_purchases (
            student_number,
            section_id,
            item_id,
            price_paid
          )
          values ($1, $2, $3, $4)
        `,
        [studentNumber, sectionId, itemId, price],
      );

      await client.query(
        `
          update public.student_muni_wardrobes
          set owned_items = $2::jsonb,
              updated_at = now()
          where student_number = $1
        `,
        [studentNumber, JSON.stringify(nextOwned)],
      );

      return serializeWardrobe({ owned_items: nextOwned, loadout: wardrobe.loadout }, nextTala);
    });

    return res.json({
      ...result,
      message: "Item unlocked.",
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        ...(error.payload || {}),
        message: error.message,
      });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ message: "Item already owned." });
    }
    return res.status(500).json({ message: error.message || "Failed to unlock item." });
  }
});

router.patch("/loadout", async (req, res) => {
  const studentNumber = resolveStudentNumber(req);
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  const requested = req.body?.loadout;
  if (!requested || typeof requested !== "object") {
    return res.status(400).json({ message: "Loadout is required." });
  }

  try {
    const result = await withTransaction(async (client) => {
      const wardrobe = await ensureWardrobeRow(client, studentNumber);
      const ownedItems = normalizeOwnedItems(wardrobe.owned_items);
      const nextLoadout = {};

      for (const sectionId of SECTION_IDS) {
        if (!Object.prototype.hasOwnProperty.call(requested, sectionId)) {
          nextLoadout[sectionId] = wardrobe.loadout?.[sectionId] ?? DEFAULT_LOADOUT[sectionId];
          continue;
        }
        const value = requested[sectionId];
        if (value === null || value === "") {
          nextLoadout[sectionId] = null;
          continue;
        }
        const itemId = String(value).trim();
        if (!ownedItems[sectionId].includes(itemId)) {
          const error = new Error("You can only equip items you own.");
          error.statusCode = 400;
          throw error;
        }
        nextLoadout[sectionId] = itemId;
      }

      await client.query(
        `
          update public.student_muni_wardrobes
          set loadout = $2::jsonb,
              updated_at = now()
          where student_number = $1
        `,
        [studentNumber, JSON.stringify(nextLoadout)],
      );

      const totalTala = await getWalletTotal(client, studentNumber);
      return serializeWardrobe({ owned_items: ownedItems, loadout: nextLoadout }, totalTala);
    });

    return res.json({
      ...result,
      message: "Look saved.",
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || "Failed to save look." });
  }
});

module.exports = router;
