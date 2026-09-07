const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function faceForWeight(w) {
  if (["700", "800", "900", "bold"].includes(w)) return "Outfit-Bold";
  if (["600", "semibold"].includes(w)) return "Outfit-SemiBold";
  if (["500", "medium"].includes(w)) return "Outfit-Medium";
  if (["400", "normal"].includes(w)) return "Outfit";
  return null;
}

const files = [...walk("app"), ...walk("components")];
let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const original = src;

  // Inline object props: fontWeight: "700" -> fontFamily: "Outfit-Bold"
  src = src.replace(/fontWeight:\s*["'](100|200|300|400|500|600|700|800|900|normal|bold|medium|semibold)["']/g, (m, w, offset) => {
    // Skip if nearby preceding 80 chars already set a non-Outfit family in same object-ish region
    const before = src.slice(Math.max(0, offset - 120), offset);
    const fam = before.match(/fontFamily:\s*["']([^"']+)["'][^}]*$/);
    if (fam && fam[1] !== "Outfit" && fam[1] !== "Outfit-Regular" && !fam[1].startsWith("Outfit-")) {
      return m; // leave serif etc.
    }
    if (fam && fam[1].startsWith("Outfit-") && fam[1] !== "Outfit-Regular") {
      return ""; // drop weight; already faced — may leave double commas, cleaned below
    }
    const face = faceForWeight(w);
    if (!face) return m;
    return `fontFamily: "${face}"`;
  });

  // Clean empty leftovers from dropped weights: ", ," or ", }" 
  src = src.replace(/,\s*,/g, ",");
  src = src.replace(/\{\s*,/g, "{");
  src = src.replace(/,\s*\}/g, " }");

  // Bad combo same object remnants: fontFamily Outfit then Outfit-Bold later already handled
  // Remove plain Outfit when Outfit-* also present in tight inline objects
  src = src.replace(/\{([^{}]{0,200})\}/g, (block) => {
    if (!/fontFamily:\s*["']Outfit-(Bold|SemiBold|Medium)["']/.test(block)) return block;
    return block.replace(/fontFamily:\s*["']Outfit["']\s*,?\s*/g, "");
  });

  if (src !== original) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated", file);
  }
}
console.log("DONE", changed);
