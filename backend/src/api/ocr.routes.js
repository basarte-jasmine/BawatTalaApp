const express = require("express");

const router = express.Router();

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function isLikelySchoolId(ocrText) {
  const normalized = normalizeText(ocrText);
  if (!normalized) return false;

  if (normalized.includes("plvworld")) {
    return true;
  }

  const requiredWords = ["pamantasan", "ng", "lungsod", "valenzuela"];
  return requiredWords.every((word) => normalized.includes(word));
}

router.post("/scan-id", async (req, res) => {
  const { imageBase64 } = req.body || {};
  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ message: "OCR.Space API key is not configured." });
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ message: "imageBase64 is required." });
  }

  try {
    const requestBody = new URLSearchParams();
    requestBody.append("apikey", apiKey);
    requestBody.append("base64Image", `data:image/jpeg;base64,${imageBase64}`);
    requestBody.append("language", "eng");
    requestBody.append("isOverlayRequired", "false");
    requestBody.append("OCREngine", "2");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      const ocrSpaceMessage = data?.ErrorMessage || "OCR.Space request failed.";
      return res.status(502).json({ message: Array.isArray(ocrSpaceMessage) ? ocrSpaceMessage.join(" ") : ocrSpaceMessage });
    }

    if (data?.IsErroredOnProcessing) {
      const ocrError = data?.ErrorMessage || data?.ErrorDetails || "OCR.Space could not process the image.";
      return res.status(502).json({ message: Array.isArray(ocrError) ? ocrError.join(" ") : ocrError });
    }

    const ocrText = data?.ParsedResults?.[0]?.ParsedText ?? "";
    const isValidId = isLikelySchoolId(ocrText);

    return res.json({
      ok: true,
      isValidId,
      ocrText,
      message: isValidId
        ? "ID scanned successfully. Review the extracted details."
        : "Uploaded image does not appear to be a valid ID.",
    });
  } catch {
    return res.status(500).json({ message: "Failed to process OCR scan." });
  }
});

module.exports = router;
