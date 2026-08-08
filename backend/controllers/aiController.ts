import { GoogleGenAI } from "@google/genai";
import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";

import { createCircuitBreaker } from "../utils/circuitBreaker.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key_if_not_set"
});

const fetchGeminiResponse = async (prompt: string) => {
  return await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
};
const geminiBreaker = createCircuitBreaker(fetchGeminiResponse);

// Calculate distance between two coordinates in km (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bug 24 Fix: Safe helper to extract text from a Gemini response.
// The `.text` shorthand is a convenience property that may not exist in all
// SDK versions or response shapes. This falls back through the full candidate
// path and returns null if no text is available.
function extractGeminiText(response: any): string | null {
  // Try the convenience shorthand first
  if (typeof response?.text === "string") return response.text;
  if (typeof response?.text === "function") {
    try { return response.text(); } catch { /* fall through */ }
  }
  // Fall back to the full candidate path
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export const recommendDrivers = async (req, res) => {
  const { hireType, vehicleType, lat, lng } = req.query;

  const filter: any = { kycStatus: "approved", isActive: true };
  if (vehicleType) {
    const types = String(vehicleType).split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length) filter.vehicleTypes = { $in: types };
  }

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const hasLocation = !isNaN(userLat) && !isNaN(userLng);

  if (hasLocation) {
    filter.location = {
      $near: {
        $geometry: { type: "Point", coordinates: [userLng, userLat] },
        $maxDistance: 50000 // 50km
      }
    };
  }

  // Find active, approved drivers (already sorted by proximity if $near is used)
  let drivers = await Driver.find(filter).select("-password -twoFactorSecret");


  // If we have Gemini configured, try to use it for smart matching
  if (process.env.GEMINI_API_KEY && drivers.length > 0) {
    try {
      const prompt = `You are a smart matchmaking AI for a driver booking app. 
      User requires: VehicleType: ${vehicleType || 'Any'}, HireType: ${hireType || 'Any'}.
      Available drivers:
      ${JSON.stringify(drivers.map(d => ({id: d._id, rating: d.averageRating, exp: d.experienceYears, vTypes: d.vehicleTypes})))}
      
      Rank the top 3 best matching drivers based on highest rating, experience, and vehicle match.
      Return ONLY a JSON array of the top 3 driver IDs. Example: ["id1", "id2", "id3"]. Do not include markdown formatting like \`\`\`json.`;

      const response = await geminiBreaker.fire(prompt);

      // Bug 24 Fix: Use null-safe text extraction instead of direct response.text access
      const responseText = extractGeminiText(response);
      if (!responseText) {
        throw new Error("Empty response from Gemini API");
      }

      const cleanedText = responseText.trim().replace(/```json/g, '').replace(/```/g, '');
      const rankedIds = JSON.parse(cleanedText);

      if (!Array.isArray(rankedIds)) {
        throw new Error("Gemini response was not a JSON array");
      }

      // Reorder drivers based on AI ranking
      const scoredDrivers = [];
      let score = 99; // Top match gets 99, next 98, etc.
      for (const id of rankedIds) {
        const d = drivers.find(drv => drv._id.toString() === id);
        if (d) {
          scoredDrivers.push({ ...d.toJSON(), aiScore: score-- });
        }
      }

      // Fill in remaining drivers if AI didn't return 3
      drivers.forEach(d => {
        if (!rankedIds.includes(d._id.toString())) {
          scoredDrivers.push({ ...d.toJSON(), aiScore: 70 });
        }
      });

      return res.json({ recommended: scoredDrivers.slice(0, 3) });
    } catch (err) {
      console.error("GenAI Matching Error, falling back to manual scoring:", err);
    }
  }

  // Fallback: Manual Scoring weights: Rating (40%), Experience (30%), Proximity (30%)
  const scoredDrivers = drivers.map(driver => {
    let score = 0;
    
    // Rating Score (up to 40)
    score += (driver.averageRating / 5) * 40;
    
    // Experience Score (up to 30) - Assume 10+ years is max score
    const exp = Math.min(driver.experienceYears, 10);
    score += (exp / 10) * 30;

    // Proximity Score
    if (hasLocation && driver.location?.coordinates?.length === 2) {
        const driverLng = driver.location.coordinates[0];
        const driverLat = driver.location.coordinates[1];
        const distance = getDistanceFromLatLonInKm(userLat, userLng, driverLat, driverLng);
        // If within 5km, max score 30. If 20km away, score 0.
        const distScore = Math.max(0, 30 - (distance * 1.5));
        score += distScore;
    } else {
        score += 15; // Default middle proximity score
    }

    return { ...driver.toJSON(), aiScore: Math.round(score) };
  });

  // Sort by highest score first
  scoredDrivers.sort((a, b) => b.aiScore - a.aiScore);

  res.json({ recommended: scoredDrivers.slice(0, 3) });
};

export const chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ 
        response: "Mock AI: I am a mock AI chatbot for MyMate. To enable real AI responses, please configure GEMINI_API_KEY." 
      });
    }

    const systemPrompt = `You are a helpful customer support AI for "MyMate", a premium driver booking platform. 
You help users book drivers, understand pricing (including surge pricing between 8-10 AM and 5-7 PM), 
and navigate the app. Be concise, polite, and strictly answer questions related to the platform.`;

    const response = await geminiBreaker.fire(systemPrompt + "\n\nUser Question: " + message);

    // Bug 24 Fix: Use null-safe text extraction
    const responseText = extractGeminiText(response);
    if (!responseText) {
      throw new Error("No response text from Gemini API");
    }

    res.json({ response: responseText });
  } catch (err) {
    console.error("AI Chatbot error:", err);
    res.status(500).json({ message: "Chatbot encountered an error." });
  }
};

export const getHeatmap = async (req, res) => {
  // Return the last 100 booking pickup coordinates for the heatmap
  // Since we don't store raw coordinates in Booking yet (just string addresses),
  // we will mock a few hotspots around the user's city based on active bookings,
  // or return actual geocoded coordinates if we had them.
  
  // For demonstration, we'll return a few dummy hotspots around a central point (e.g. Mumbai)
  const baseLat = 19.0760;
  const baseLng = 72.8777;
  
  const heatPoints = [];
  for(let i = 0; i < 50; i++) {
      // Random points within ~10km radius
      const lat = baseLat + (Math.random() - 0.5) * 0.1;
      const lng = baseLng + (Math.random() - 0.5) * 0.1;
      const intensity = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
      heatPoints.push([lat, lng, intensity]);
  }

  res.json({ heatPoints });
};
