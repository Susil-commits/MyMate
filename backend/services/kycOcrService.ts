// @ts-nocheck
import Tesseract from "tesseract.js";
import logger from "../config/logger.js";

export interface KycOcrResult {
  rawText: string;
  extractedLicenseNumber: string | null;
  confidence: number; // 0–100
  isValid: boolean;
  flags: string[];
}

/**
 * Indian driving-licence number patterns:
 *   HR-0619850034761  (old format)
 *   MH01 20110005547  (space format)
 *   DL-1420110005547  (15-digit)
 * We accept any of these with some leniency for OCR noise.
 */
const LICENSE_REGEXES = [
  /\b([A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}\d{7})\b/,   // 15-char DL
  /\b([A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}\d{6})\b/,    // 14-char variant
  /\b([A-Z]{2}\d{13})\b/,                           // no separator
];

/**
 * Runs Tesseract OCR on a publicly-accessible image URL.
 * Called by verifyKyc controller (admin-only).
 */
export async function runKycOcr(imageUrl: string): Promise<KycOcrResult> {
  logger.info(`[KYC OCR] Starting OCR for image: ${imageUrl}`);

  let worker: Tesseract.Worker | null = null;

  try {
    worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          logger.debug(`[KYC OCR] Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });

    // Optimise for documents: PSM 6 = uniform block of text
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(imageUrl);
    const rawText = data.text.trim();
    const confidence = Math.round(data.confidence); // 0-100

    logger.info(`[KYC OCR] Confidence: ${confidence}%`);
    logger.debug(`[KYC OCR] Raw text:\n${rawText}`);

    // Try to extract a licence number
    const upperText = rawText.toUpperCase().replace(/[|]/g, "I").replace(/[O]/g, "0");
    let extractedLicenseNumber: string | null = null;

    for (const regex of LICENSE_REGEXES) {
      const match = upperText.match(regex);
      if (match) {
        extractedLicenseNumber = match[1].replace(/\s/g, "").replace(/-/g, "");
        break;
      }
    }

    const flags: string[] = [];

    if (confidence < 50) flags.push("LOW_CONFIDENCE");
    if (!extractedLicenseNumber) flags.push("NO_LICENSE_NUMBER_FOUND");
    if (rawText.length < 20) flags.push("TOO_LITTLE_TEXT");

    const isValid =
      extractedLicenseNumber !== null &&
      confidence >= 50 &&
      flags.length === 0;

    return { rawText, extractedLicenseNumber, confidence, isValid, flags };
  } finally {
    if (worker) {
      await worker.terminate();
      logger.debug("[KYC OCR] Worker terminated.");
    }
  }
}
