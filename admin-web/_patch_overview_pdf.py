from pathlib import Path

path = Path(r"C:\Users\Jasmine Basarte\BawatTalaApp\admin-web\src\pages\Overview.jsx")
text = path.read_text(encoding="utf-8")

old_start = "function sanitizeDashboardSnapshotClone(clone) {"
old_end = "function escapePdfText(value) {"
i = text.find(old_start)
j = text.find(old_end)
if i < 0 or j < 0 or j <= i:
    raise SystemExit(f"markers not found i={i} j={j}")

new_fns = r'''function hideExportIgnoredNodes(element) {
  const ignored = Array.from(element.querySelectorAll("[data-export-ignore='true']"));
  const previous = ignored.map((node) => node.getAttribute("style"));
  ignored.forEach((node) => {
    node.style.display = "none";
  });
  return () => {
    ignored.forEach((node, index) => {
      const previousStyle = previous[index];
      if (previousStyle === null) node.removeAttribute("style");
      else node.setAttribute("style", previousStyle);
    });
  };
}

function replaceLiveCanvasesWithImages(liveRoot, cloneRoot) {
  const liveCanvases = liveRoot.querySelectorAll("canvas");
  const cloneCanvases = cloneRoot.querySelectorAll("canvas");
  liveCanvases.forEach((liveCanvas, index) => {
    const cloneCanvas = cloneCanvases[index];
    if (!cloneCanvas) return;
    try {
      const image = document.createElement("img");
      image.setAttribute("alt", liveCanvas.getAttribute("aria-label") || "Chart");
      image.setAttribute("src", liveCanvas.toDataURL("image/png"));
      const computed = window.getComputedStyle(liveCanvas);
      image.style.width = computed.width;
      image.style.height = computed.height;
      image.style.display = computed.display === "inline" ? "inline-block" : computed.display;
      image.style.maxWidth = "100%";
      cloneCanvas.replaceWith(image);
    } catch {
      // Keep the cloned canvas rather than dropping chart layout.
    }
  });
}

function inlineLiveImages(liveRoot, cloneRoot) {
  const liveImages = liveRoot.querySelectorAll("img");
  const cloneImages = cloneRoot.querySelectorAll("img");
  liveImages.forEach((liveImage, index) => {
    const cloneImage = cloneImages[index];
    if (!cloneImage) return;
    if (String(liveImage.src || "").startsWith("data:")) {
      cloneImage.setAttribute("src", liveImage.src);
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = liveImage.naturalWidth || liveImage.width || 1;
      canvas.height = liveImage.naturalHeight || liveImage.height || 1;
      const context = canvas.getContext("2d");
      context.drawImage(liveImage, 0, 0);
      cloneImage.setAttribute("src", canvas.toDataURL("image/png"));
    } catch {
      // Keep the original src if the image cannot be rasterized.
    }
  });
}

function prepareDashboardSnapshotClone(liveRoot, clone) {
  clone.querySelectorAll("[data-export-ignore='true']").forEach((node) => node.remove());
  replaceLiveCanvasesWithImages(liveRoot, clone);
  inlineLiveImages(liveRoot, clone);
  clone.querySelectorAll("iframe, video").forEach((node) => {
    const placeholder = document.createElement("div");
    placeholder.style.width = `${node.offsetWidth || 0}px`;
    placeholder.style.height = `${node.offsetHeight || 0}px`;
    node.replaceWith(placeholder);
  });
}

function collectExportBlocks(root) {
  const candidates = Array.from(root.querySelectorAll("[data-export-block], .bt-card"));
  const blocks = candidates.filter((node) => !candidates.some((other) => other !== node && other.contains(node)));
  const rootRect = root.getBoundingClientRect();
  return blocks
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top - rootRect.top + root.scrollTop,
        left: rect.left - rootRect.left + root.scrollLeft,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((block) => block.width > 2 && block.height > 2)
    .sort((a, b) => a.top - b.top || a.left - b.left);
}

function mergeOverlappingExportBlocks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    const bottom = block.top + block.height;
    const previous = merged[merged.length - 1];
    if (previous && block.top < previous.bottom - 8) {
      previous.top = Math.min(previous.top, block.top);
      previous.bottom = Math.max(previous.bottom, bottom);
      return;
    }
    merged.push({ top: block.top, bottom });
  });
  return merged;
}

function paginateExportSnapshot(totalHeight, blocks, maxContentHeight) {
  const zones = mergeOverlappingExportBlocks(blocks);
  const pages = [];
  let y = 0;

  while (y < totalHeight - 0.5) {
    const remaining = totalHeight - y;
    if (remaining <= 1) break;

    const tallZone = zones.find((zone) => Math.abs(zone.top - y) <= 16 && zone.bottom - Math.min(zone.top, y) > maxContentHeight);
    if (tallZone) {
      pages.push({ top: y, bottom: tallZone.bottom, fit: true });
      y = tallZone.bottom;
      continue;
    }

    const limit = Math.min(y + maxContentHeight, totalHeight);
    let breakAt = limit;
    const crossing = zones.find((zone) => breakAt > zone.top + 1 && breakAt < zone.bottom - 1);
    if (crossing) {
      if (crossing.top <= y + 1) {
        pages.push({ top: y, bottom: crossing.bottom, fit: true });
        y = crossing.bottom;
        continue;
      }
      breakAt = crossing.top;
    }

    const snapBottoms = zones.map((zone) => zone.bottom).filter((bottom) => bottom > y + 32 && bottom <= breakAt + 0.5);
    if (snapBottoms.length) {
      breakAt = Math.max(...snapBottoms);
    }

    if (breakAt <= y + 8) {
      breakAt = Math.min(y + maxContentHeight, totalHeight);
    }

    pages.push({ top: y, bottom: breakAt, fit: false });
    y = breakAt;
  }

  return pages.length ? pages : [{ top: 0, bottom: totalHeight, fit: false }];
}

async function rasterizeCloneToCanvas(clone, width, height, scale) {
  clone.style.width = `${width}px`;
  clone.style.maxWidth = "none";
  clone.style.background = "#ffffff";

  const snapshotContent = serializeDashboardSnapshotContent(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/1999/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        ${snapshotContent}
      </foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function captureElementCanvas(element) {
  const restoreIgnored = hideExportIgnoredNodes(element);
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const width = Math.ceil(element.scrollWidth);
    const height = Math.ceil(element.scrollHeight);
    const blocks = collectExportBlocks(element);
    const scale = 2;
    const clone = element.cloneNode(true);
    prepareDashboardSnapshotClone(element, clone);
    const canvas = await rasterizeCloneToCanvas(clone, width, height, scale);
    canvas.__overviewExportMeta = { scale, cssWidth: width, cssHeight: height, blocks };
    canvas.__overviewPageBreaks = blocks.map((block) => Math.ceil((block.top + block.height) * scale));
    return canvas;
  } finally {
    restoreIgnored();
  }
}

async function captureElementCanvasAttached(element) {
  const restoreIgnored = hideExportIgnoredNodes(element);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-14000px;top:0;background:#ffffff;pointer-events:none;z-index:-1;";
  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const width = Math.ceil(element.scrollWidth);
    const height = Math.ceil(element.scrollHeight);
    const blocks = collectExportBlocks(element);
    const clone = element.cloneNode(true);
    prepareDashboardSnapshotClone(element, clone);
    clone.style.width = `${width}px`;
    host.appendChild(clone);
    document.body.appendChild(host);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const canvas = await rasterizeCloneToCanvas(clone, width, Math.ceil(clone.scrollHeight || height), 2);
    canvas.__overviewExportMeta = {
      scale: 2,
      cssWidth: width,
      cssHeight: Math.ceil(clone.scrollHeight || height),
      blocks,
    };
    return canvas;
  } finally {
    restoreIgnored();
    host.remove();
  }
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createPdfFromCanvas(canvas, pageBreaksOrOptions = []) {
  const options = Array.isArray(pageBreaksOrOptions) ? { pageBreaks: pageBreaksOrOptions } : pageBreaksOrOptions || {};
  const meta = canvas.__overviewExportMeta || {};
  const scale = Number(meta.scale || canvas.height / Math.max(meta.cssHeight || canvas.height, 1)) || 1;
  const cssHeight = Number(meta.cssHeight || canvas.height / scale);
  const rangeLabel = escapePdfText(options.rangeLabel || options.todayLabel || "Selected range");
  const blocks = Array.isArray(meta.blocks) && meta.blocks.length
    ? meta.blocks
    : (options.pageBreaks || canvas.__overviewPageBreaks || []).map((breakPoint, index, items) => {
        const previous = index === 0 ? 0 : items[index - 1];
        return { top: previous / scale, height: (breakPoint - previous) / scale, width: 1, left: 0 };
      });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const headerBand = 26;
  const footerBand = 22;
  const imageWidth = pageWidth - margin * 2;
  const contentHeightPdf = pageHeight - margin * 2 - headerBand - footerBand;
  const maxCssHeight = Math.max(120, (contentHeightPdf * canvas.width) / imageWidth / scale);
  const pages = paginateExportSnapshot(cssHeight, blocks, maxCssHeight);

  const slices = pages.map((page) => {
    const sourceY = Math.max(0, Math.round(page.top * scale));
    const sourceBottom = Math.min(canvas.height, Math.round(page.bottom * scale));
    const sourceHeight = Math.max(1, sourceBottom - sourceY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sourceHeight;
    const context = sliceCanvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    let drawWidth = imageWidth;
    let drawHeight = imageWidth * (sourceHeight / canvas.width);
    if (page.fit || drawHeight > contentHeightPdf) {
      const fitScale = contentHeightPdf / drawHeight;
      drawWidth *= fitScale;
      drawHeight *= fitScale;
    }

    return {
      width: sliceCanvas.width,
      height: sliceCanvas.height,
      bytes: dataUrlToBytes(sliceCanvas.toDataURL("image/jpeg", 0.95)),
      drawWidth,
      drawHeight,
      drawX: margin + (imageWidth - drawWidth) / 2,
    };
  });

  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let byteOffset = 0;
  const appendString = (value) => {
    const bytes = encoder.encode(value);
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const appendBytes = (bytes) => {
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const appendObject = (id, contentParts) => {
    offsets[id] = byteOffset;
    appendString(`${id} 0 obj\n`);
    contentParts.forEach((part) => {
      if (typeof part === "string") appendString(part);
      else appendBytes(part);
    });
    appendString("\nendobj\n");
  };

  appendString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = slices.map((_, index) => 5 + index * 3);
  appendObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  appendObject(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);
  appendObject(3, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]);
  appendObject(4, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]);

  slices.forEach((slice, index) => {
    const pageId = 5 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const drawY = margin + footerBand;
    const headerY = pageHeight - margin - 8;
    const footerY = margin + 6;
    const pageLabel = `Page ${index + 1} of ${slices.length}`;
    const headerTitle = "Bawat Tala Overview";
    const content = [
      `BT /F2 10 Tf 1 0 0 1 ${margin.toFixed(2)} ${headerY.toFixed(2)} Tm (${headerTitle}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 ${margin.toFixed(2)} ${(headerY - 12).toFixed(2)} Tm (${rangeLabel}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 ${(pageWidth - margin - 70).toFixed(2)} ${headerY.toFixed(2)} Tm (${escapePdfText(pageLabel)}) Tj ET`,
      `q`,
      `${slice.drawWidth.toFixed(2)} 0 0 ${slice.drawHeight.toFixed(2)} ${slice.drawX.toFixed(2)} ${drawY.toFixed(2)} cm`,
      `/${imageName} Do`,
      `Q`,
      `BT /F1 8 Tf 1 0 0 1 ${margin.toFixed(2)} ${footerY.toFixed(2)} Tm (${rangeLabel}  |  ${escapePdfText(pageLabel)}) Tj ET`,
    ].join("\n");

    appendObject(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    appendObject(contentId, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
    appendObject(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${slice.width} /Height ${slice.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.bytes.length} >>\nstream\n`,
      slice.bytes,
      "\nendstream",
    ]);
  });

  const xrefOffset = byteOffset;
  const maxObjectId = 4 + slices.length * 3;
  appendString(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxObjectId; id += 1) {
    appendString(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  appendString(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

'''

text = text[:i] + new_fns + old_end + text[j + len(old_end):]
path.write_text(text, encoding="utf-8")
print("replaced snapshot/pdf helpers", i, j)
print("new length", len(text))
