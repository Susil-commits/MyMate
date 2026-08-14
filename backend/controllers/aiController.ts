// @ts-nocheck
import { GoogleGenAI } from "@google/genai";
import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import { createCircuitBreaker } from "../utils/circuitBreaker.js";
import { runKycOcr } from "../services/kycOcrService.js";
import { findBestDrivers } from "../services/driverMatchingService.js";

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key_if_not_set",
});

const GEMINI_MODEL = "gemini-flash-latest";

/**
 * Wraps a multi-turn Gemini request in the circuit breaker.
 * `contents` is the full conversation array (user + model turns).
 */
const fetchGeminiMultiTurn = async (contents: any[], systemInstruction?: string) => {
  return await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    ...(systemInstruction && {
      systemInstruction: { parts: [{ text: systemInstruction }] },
    }),
  });
};
const geminiBreaker = createCircuitBreaker(fetchGeminiMultiTurn);

// Helpers
/** Haversine formula for great-circle distance calculation */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Helper to safely extract text from Gemini API response structures.
 */
function extractGeminiText(response: any): string | null {
  if (typeof response?.text === "string") return response.text;
  if (typeof response?.text === "function") {
    try {
      return response.text();
    } catch {
      /* fall through */
    }
  }
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/** Strips markdown code fences that Gemini sometimes adds */
function cleanJsonResponse(text: string): string {
  return text.trim().replace(/```json/g, "").replace(/```/g, "").trim();
}

// Controller handlers

/**
 * GET /api/ai/recommend
 * AI-powered driver recommendation using Gemini + heuristic fallback.
 * Ranks up to 3 best-matching drivers given hire type, vehicle type, and location.
 */
export const recommendDrivers = async (req, res) => {
  const { hireType, vehicleType, lat, lng } = req.query;

  const filter: any = { kycStatus: "approved", isActive: true };
  if (vehicleType) {
    const types = String(vehicleType)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length) filter.vehicleTypes = { $in: types };
  }

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const hasLocation = !isNaN(userLat) && !isNaN(userLng);

  if (hasLocation) {
    filter.location = {
      $near: {
        $geometry: { type: "Point", coordinates: [userLng, userLat] },
        $maxDistance: 50000, // 50 km
      },
    };
  }

  let drivers = await Driver.find(filter).select("-password -twoFactorSecret");

  // Gemini AI Ranking
  if (process.env.GEMINI_API_KEY && drivers.length > 0) {
    try {
      const driverSummaries = drivers.map((d) => ({
        id: d._id,
        rating: d.averageRating,
        exp: d.experienceYears,
        vTypes: d.vehicleTypes,
        distKm: hasLocation
          ? haversineKm(
              userLat,
              userLng,
              d.location?.coordinates?.[1] ?? userLat,
              d.location?.coordinates?.[0] ?? userLng
            ).toFixed(1)
          : "unknown",
        reviews: d.totalReviews,
      }));

      const prompt = `You are a smart matchmaking AI for MyMate, a premium driver booking platform.

User needs: VehicleType="${vehicleType || "Any"}", HireType="${hireType || "Any"}".
Available drivers (JSON): ${JSON.stringify(driverSummaries)}

Rank the top 3 best-matching drivers. Prioritise: highest rating, most experience, closest distance, most reviews.
Return ONLY a JSON array of the top 3 driver IDs in order. Example: ["id1","id2","id3"]. No markdown, no explanation.`;

      const response = await geminiBreaker.fire(
        [{ role: "user", parts: [{ text: prompt }] }]
      );

      const responseText = extractGeminiText(response);
      if (!responseText) throw new Error("Empty response from Gemini");

      const rankedIds = JSON.parse(cleanJsonResponse(responseText));
      if (!Array.isArray(rankedIds)) throw new Error("Not a JSON array");

      const scoredDrivers: any[] = [];
      let score = 99;
      for (const id of rankedIds) {
        const d = drivers.find((drv) => drv._id.toString() === String(id));
        if (d) scoredDrivers.push({ ...d.toJSON(), aiScore: score--, aiRankedBy: "gemini" });
      }

      // Append remaining (not in top-3) with a base heuristic score
      drivers.forEach((d) => {
        if (!rankedIds.map(String).includes(d._id.toString())) {
          const dist = hasLocation
            ? haversineKm(userLat, userLng, d.location?.coordinates?.[1] ?? userLat, d.location?.coordinates?.[0] ?? userLng)
            : 10;
          const s = Math.round((d.averageRating / 5) * 40 + (Math.min(d.experienceYears, 10) / 10) * 30 + Math.max(0, 30 - dist * 1.5));
          scoredDrivers.push({ ...d.toJSON(), aiScore: s, aiRankedBy: "heuristic" });
        }
      });

      return res.json({ recommended: scoredDrivers.slice(0, 3), rankedBy: "gemini" });
    } catch (err) {
      console.error("GenAI Matching Error, falling back to heuristic scoring:", err);
    }
  }

  // Heuristic Fallback Ranking
  const scoredDrivers = drivers.map((driver) => {
    let score = 0;
    score += (driver.averageRating / 5) * 40; // Rating (40%)
    score += (Math.min(driver.experienceYears, 10) / 10) * 30; // Experience (30%)

    if (hasLocation && driver.location?.coordinates?.length === 2) {
      const dist = haversineKm(
        userLat,
        userLng,
        driver.location.coordinates[1],
        driver.location.coordinates[0]
      );
      score += Math.max(0, 30 - dist * 1.5); // Proximity (30%)
    } else {
      score += 15; // Default mid-score when no location
    }

    return { ...driver.toJSON(), aiScore: Math.round(score), aiRankedBy: "heuristic" };
  });

  scoredDrivers.sort((a, b) => b.aiScore - a.aiScore);
  res.json({ recommended: scoredDrivers.slice(0, 3), rankedBy: "heuristic" });
};



/**
 * POST /api/ai/chat
 * Multi-turn AI chatbot powered by Gemini.
 *
 * Body: { message: string, history: Array<{ role: "user"|"model", text: string }> }
 *
 * `history` is maintained by the client (React state) and replayed here so
 * Gemini has full conversation context without requiring a server-side session.
 */
export const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim())
      return res.status(400).json({ message: "Message is required" });

    // Graceful mock when key is absent
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        response:
          "**MyMate AI (Mock Mode)**\nI'm running in mock mode because `GEMINI_API_KEY` is not configured. " +
          "Please add it to your `.env` file to enable real AI responses.",
        history: [
          ...history,
          { role: "user", text: message },
          {
            role: "model",
            text: "Mock response — GEMINI_API_KEY not set.",
          },
        ],
      });
    }

    const systemInstruction = `You are a helpful, concise customer support AI for "MyMate" — a premium driver booking platform in India.
Your job: help users book drivers, understand pricing (surge pricing applies 8–10 AM and 5–7 PM and midnight–5 AM), manage bookings, and navigate the app.
Rules:
- Only answer questions related to MyMate features.
- For unrelated questions, politely redirect to platform topics.
- Format responses with markdown: use **bold**, bullet points, and short paragraphs.
- Keep replies under 150 words unless a detailed explanation is needed.`;

    // Build the multi-turn contents array from client-supplied history
    const contents = [
      ...history.map((h) => ({
        role: h.role === "bot" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const response = await geminiBreaker.fire(contents, systemInstruction);
    const responseText = extractGeminiText(response);

    if (!responseText) throw new Error("No text from Gemini API");

    // Return response + updated history (client stores this for the next turn)
    const updatedHistory = [
      ...history,
      { role: "user", text: message },
      { role: "model", text: responseText },
    ];

    res.json({ response: responseText, history: updatedHistory });
  } catch (err) {
    console.error("AI Chatbot error:", err);
    res.status(500).json({ message: "Chatbot encountered an error. Please try again." });
  }
};



/**
 * GET /api/ai/heatmap
 * Returns demand heatmap points from real booking pickup coordinates.
 * Requires driver role. Falls back to synthetic points if no bookings
 * have coordinates stored yet (graceful degradation).
 */
export const getHeatmap = async (req, res) => {
  // Pull real pickup coordinates from the last 500 completed/ongoing bookings
  const recentBookings = await Booking.find(
    {
      status: { $in: ["completed", "ongoing", "accepted"] },
      "pickupCoordinates.lat": { $exists: true },
      "pickupCoordinates.lng": { $exists: true },
    },
    { pickupCoordinates: 1, _id: 0 }
  )
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  let heatPoints: [number, number, number][] = recentBookings.map((b) => [
    b.pickupCoordinates!.lat,
    b.pickupCoordinates!.lng,
    1.0, // uniform intensity for real points; can weight by count if needed
  ]);

  // Fallback hotspot generation if dataset is empty
  if (heatPoints.length < 5) {
    // Generate plausible hotspots around a few Indian metro centres
    const cities = [
      { lat: 19.076, lng: 72.8777, label: "Mumbai" },
      { lat: 12.9716, lng: 77.5946, label: "Bangalore" },
      { lat: 28.6139, lng: 77.209, label: "Delhi" },
    ];

    heatPoints = [];
    for (const city of cities) {
      for (let i = 0; i < 17; i++) {
        heatPoints.push([
          city.lat + (Math.random() - 0.5) * 0.12,
          city.lng + (Math.random() - 0.5) * 0.12,
          Math.random() * 0.8 + 0.2,
        ]);
      }
    }
  }

  res.json({ heatPoints, source: recentBookings.length >= 5 ? "live" : "synthetic" });
};



/**
 * POST /api/ai/verify-kyc
 * Admin-only. Runs Tesseract.js OCR on a driver's licence image URL.
 * Returns extracted text, confidence score, and validation flags for
 * the admin to make a final approval/rejection decision.
 *
 * Body: { imageUrl: string, driverId: string }
 */
export const verifyKyc = async (req, res) => {
  const { imageUrl, driverId } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ message: "imageUrl is required" });
  }

  try {
    const result = await runKycOcr(imageUrl);

    // If we got a licence number and confidence is high enough, optionally
    // cross-check with the driver record to see if it matches the stored number.
    let licenseMatch: boolean | null = null;
    if (driverId && result.extractedLicenseNumber) {
      const driver = await Driver.findById(driverId).select("licenseNumber");
      if (driver?.licenseNumber) {
        const normalize = (s: string) => s.toUpperCase().replace(/[-\s]/g, "");
        licenseMatch =
          normalize(driver.licenseNumber) ===
          normalize(result.extractedLicenseNumber);
      }
    }

    res.json({
      ...result,
      licenseMatch,
      recommendation: result.isValid && licenseMatch !== false ? "approve" : "review",
    });
  } catch (err: any) {
    console.error("KYC OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", error: err.message });
  }
};



/**
 * GET /api/ai/match
 * Exposes the pure-core driver matching service via an HTTP endpoint.
 * Uses the Haskell-inspired functional scoring (rankDrivers) with Haversine
 * distances, wrapped in the impure shell (driverMatchingService).
 *
 * Query: { lat, lng, limit? }
 */
export const getDriverMatch = async (req, res) => {
  const userLat = parseFloat(req.query.lat as string);
  const userLng = parseFloat(req.query.lng as string);
  const limit = Math.min(parseInt(req.query.limit as string) || 3, 10);

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ message: "lat and lng query parameters are required" });
  }

  const candidates = await findBestDrivers(userLat, userLng, limit);

  res.json({
    matches: candidates,
    scoringMethod: "pure-functional (rating × 10 + acceptRate × 0.5 − distance × 2 − idleMin × 1)",
    count: candidates.length,
  });
};
