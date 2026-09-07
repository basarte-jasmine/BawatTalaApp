const fs = require("fs");
const path = require("path");

const roots = [
  path.join("app"),
  path.join("components"),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function faceForWeight(weight) {
  const w = String(weight).replace(/['"]/g, "");
  if (["700", "800", "900", "bold"].includes(w)) return "Outfit-Bold";
  if (["600", "semibold"].includes(w)) return "Outfit-SemiBold";
  if (["500", "medium"].includes(w)) return "Outfit-Medium";
  if (["400", "normal", "300", "200", "100"].includes(w)) return "Outfit";
  return null;
}

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const original = src;

  // Within each StyleSheet-like object block is hard; do line-aware transforms
  // for common `fontWeight: "###"` properties, skipping non-Outfit families in same object.

  // Split into style object chunks heuristically by braces while tracking fontFamily.
  // Safer approach: replace fontWeight lines, then clean Outfit + Outfit-* duplicate families.

  const lines = src.split(/\r?\n/);
  const out = [];
  let objectFontFamily = null;
  let depthInStyles = 0;

  // Track brace depth only loosely for object property context
  let braceDepth = 0;
  const familyStack = [null];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const open = (line.match(/{/g) || []).length;
    const close = (line.match(/}/g) || []).length;

    const familyMatch = line.match(/fontFamily:\s*["']([^"']+)["']/);
    if (familyMatch && open === 0) {
      // property inside current object
      familyStack[familyStack.length - 1] = familyMatch[1];
    }

    const weightMatch = line.match(/^(\s*)fontWeight:\s*["']([^"']+)["'](\s*as\s+[^,]+)?(,)?\s*$/);
    if (weightMatch) {
      const indent = weightMatch[1];
      const weight = weightMatch[2];
      const comma = weightMatch[4] || "";
      const currentFamily = familyStack[familyStack.length - 1];
      const face = faceForWeight(weight);

      // Look ahead/behind in nearby lines of same object for fontFamily
      let nearbyFamily = currentFamily;
      for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
        if (lines[j].includes("{") && !lines[j].includes("}")) break;
        if (lines[j].trim().startsWith("}")) break;
        const fm = lines[j].match(/fontFamily:\s*["']([^"']+)["']/);
        if (fm) { nearbyFamily = fm[1]; break; }
      }
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 12); j++) {
        if (lines[j].trim().startsWith("}")) break;
        const fm = lines[j].match(/fontFamily:\s*["']([^"']+)["']/);
        if (fm) { nearbyFamily = fm[1]; break; }
      }

      const outfitish = !nearbyFamily || nearbyFamily === "Outfit" || nearbyFamily === "Outfit-Regular" || nearbyFamily.startsWith("Outfit-");
      if (face && outfitish) {
        if (nearbyFamily && nearbyFamily.startsWith("Outfit-") && nearbyFamily !== "Outfit-Regular") {
          // Already has a face — drop fontWeight entirely
          continue;
        }
        // If same object already has fontFamily: "Outfit", replace that line later; here emit face
        line = `${indent}fontFamily: "${face}"${comma}`;
        // Mark so we can remove prior Outfit family in object
        familyStack[familyStack.length - 1] = face;
      }
    }

    // Remove redundant fontFamily: "Outfit" when object will/has Outfit-* face from previous transform
    // Handled in second pass

    out.push(line);

    // Update stack on braces
    if (open || close) {
      for (let k = 0; k < open; k++) familyStack.push(null);
      for (let k = 0; k < close; k++) {
        if (familyStack.length > 1) familyStack.pop();
      }
    }
  }

  src = out.join("\n");

  // Second pass: in objects that contain Outfit-* face, remove plain fontFamily: "Outfit"
  src = src.replace(/\{([^{}]*?)\}/gs, (block) => {
    if (!/fontFamily:\s*["']Outfit-(Bold|SemiBold|Medium)["']/.test(block)) return block;
    return block.replace(/\n\s*fontFamily:\s*["']Outfit["']\s*,?/, "\n");
  });

  // Third pass: explicit bad combos on consecutive lines
  src = src.replace(
    /fontFamily:\s*["']Outfit["']\s*,\s*\n(\s*)fontFamily:\s*["']Outfit-(Bold|SemiBold|Medium)["']/g,
    "fontFamily: \"Outfit-$2\""
  );
  src = src.replace(
    /fontFamily:\s*["']Outfit["']\s*,\s*\n(\s*)fontWeight:\s*["'](700|800|900|bold|600|500)["']/g,
    (m, indent, w) => {
      const face = faceForWeight(w);
      return `fontFamily: "${face}"`;
    }
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src, "utf8");
    return true;
  }
  return false;
}

const files = roots.flatMap((r) => walk(r));
let changed = 0;
for (const f of files) {
  try {
    if (transformFile(f)) {
      changed += 1;
      console.log("updated", f);
    }
  } catch (e) {
    console.error("fail", f, e.message);
  }
}
console.log("DONE changed", changed, "of", files.length);
