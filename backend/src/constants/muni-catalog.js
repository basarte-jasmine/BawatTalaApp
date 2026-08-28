const SECTION_IDS = ["head", "eye", "outfit", "background"];

const MUNI_CATALOG = {
  head: [
    { id: "artist-beret", label: "Artist Beret", price: 120 },
    { id: "beanie", label: "Beanie", price: 0, starter: true },
    { id: "clown-wig", label: "Clown Wig", price: 140 },
    { id: "cowboy-hat", label: "Cowboy Hat", price: 130 },
    { id: "knight-helmet", label: "Knight Helmet", price: 180 },
    { id: "laurel-wreath", label: "Laurel Wreath", price: 110 },
    { id: "pirate-hat", label: "Pirate Hat", price: 145 },
    { id: "safari-hat", label: "Safari Hat", price: 135 },
    { id: "space-helmet", label: "Space Helmet", price: 170 },
    { id: "summer-hat", label: "Summer Hat", price: 125 },
    { id: "wizard-hat", label: "Wizard Hat", price: 160 },
  ],
  eye: [
    { id: "cinema-glasses", label: "Cinema Glasses", price: 0, starter: true },
    { id: "circle-sunglasses", label: "Circle Sunglasses", price: 95 },
    { id: "cyber-visor", label: "Cyber Visor", price: 140 },
  ],
  outfit: [
    { id: "classic", label: "Classic Muni", price: 0, starter: true },
    { id: "spooky-ghost", label: "Spooky Ghost", price: 0, starter: true },
  ],
  background: [
    { id: "beach", label: "Beach", price: 120 },
    { id: "garden", label: "Garden", price: 0, starter: true },
    { id: "hill", label: "Hill", price: 110 },
    { id: "museum", label: "Museum", price: 150 },
    { id: "pirate-ship", label: "Pirate Ship", price: 165 },
  ],
};

const DEFAULT_LOADOUT = {
  background: "garden",
  head: "beanie",
  eye: "cinema-glasses",
  outfit: "spooky-ghost",
};

const REMOVED_PAID_ITEMS = {
  "star-cloak": 150,
  "night-cape": 165,
  "leaf-poncho": 140,
};

function isRemovedPaidItem(itemId) {
  return Object.prototype.hasOwnProperty.call(REMOVED_PAID_ITEMS, String(itemId || "").trim());
}

function listRemovedPaidItemIds() {
  return Object.keys(REMOVED_PAID_ITEMS);
}

function getRemovedPaidItemPrice(itemId) {
  const id = String(itemId || "").trim();
  return Number(REMOVED_PAID_ITEMS[id] || 0);
}

function collectRemovedOwnedItemIds(rawOwned) {
  const ids = [];
  for (const sectionId of SECTION_IDS) {
    const values = Array.isArray(rawOwned?.[sectionId]) ? rawOwned[sectionId] : [];
    for (const value of values) {
      const id = String(value || "").trim();
      if (id && isRemovedPaidItem(id) && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

function restoreRemovedLoadoutSlots(rawLoadout) {
  const loadout = rawLoadout && typeof rawLoadout === "object" ? { ...rawLoadout } : {};
  for (const sectionId of SECTION_IDS) {
    const itemId = String(loadout[sectionId] || "").trim();
    if (itemId && isRemovedPaidItem(itemId)) {
      loadout[sectionId] = DEFAULT_LOADOUT[sectionId];
    }
  }
  return loadout;
}

function createStarterOwnedItems() {
  return SECTION_IDS.reduce((owned, sectionId) => {
    owned[sectionId] = MUNI_CATALOG[sectionId]
      .filter((item) => item.starter)
      .map((item) => item.id);
    return owned;
  }, {});
}

function getCatalogItem(sectionId, itemId) {
  if (!SECTION_IDS.includes(sectionId) || !itemId) return null;
  return MUNI_CATALOG[sectionId].find((item) => item.id === itemId) || null;
}

function normalizeOwnedItems(rawOwned) {
  const starters = createStarterOwnedItems();
  const owned = {};
  for (const sectionId of SECTION_IDS) {
    const values = Array.isArray(rawOwned?.[sectionId]) ? rawOwned[sectionId] : [];
    const next = [];
    for (const value of [...starters[sectionId], ...values]) {
      const id = String(value || "").trim();
      if (id && getCatalogItem(sectionId, id) && !next.includes(id)) {
        next.push(id);
      }
    }
    owned[sectionId] = next;
  }
  return owned;
}

function normalizeLoadout(rawLoadout, ownedItems) {
  const loadout = {};
  for (const sectionId of SECTION_IDS) {
    const value = rawLoadout?.[sectionId];
    if (value === null || value === "") {
      loadout[sectionId] = null;
      continue;
    }
    const itemId = String(value || "").trim();
    if (itemId && ownedItems[sectionId].includes(itemId)) {
      loadout[sectionId] = itemId;
    } else {
      loadout[sectionId] = DEFAULT_LOADOUT[sectionId];
    }
  }
  return loadout;
}

module.exports = {
  DEFAULT_LOADOUT,
  MUNI_CATALOG,
  REMOVED_PAID_ITEMS,
  SECTION_IDS,
  collectRemovedOwnedItemIds,
  createStarterOwnedItems,
  getCatalogItem,
  getRemovedPaidItemPrice,
  isRemovedPaidItem,
  listRemovedPaidItemIds,
  normalizeLoadout,
  normalizeOwnedItems,
  restoreRemovedLoadoutSlots,
};
