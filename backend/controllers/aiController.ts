// @ts-nocheck
import { GoogleGenAI } from "@google/genai";
import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key_if_not_set"
});

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

export const recommendDrivers = async (req, res) => {
  const { hireType, vehicleType, lat, lng } = req.query;

  const filter = { kycStatus: "approved", isActive: true };
  if (vehicleType) filter.vehicleTypes = vehicleType;

  // Find active, approved drivers
  let drivers = await Driver.find(filter).select("-password -twoFactorSecret");

  // Scoring weights: Rating (40%), Experience (30%), Proximity (30%)
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  const scoredDrivers = drivers.map(driver => {
    let score = 0;
    
    // Rating Score (up to 40)
    score += (driver.averageRating / 5) * 40;
    
    // Experience Score (up to 30) - Assume 10+ years is max score
    const exp = Math.min(driver.experienceYears, 10);
    score += (exp / 10) * 30;

    // Proximity Score (up to 30) - Only if coords are provided
    if (!isNaN(userLat) && !isNaN(userLng) && driver.location && driver.location.coordinates) {
      const dLat = driver.location.coordinates[1];
      const dLng = driver.location.coordinates[0];
      const dist = getDistanceFromLatLonInKm(userLat, userLng, dLat, dLng);
      // Closer is better. Assume > 50km = 0 score. 0km = 30 score.
      const distScore = Math.max(0, 30 - (dist / 50) * 30);
      score += distScore;
    } else {
      // If no location data, give average proximity score
      score += 15;
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

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [{ text: systemPrompt + "\n\nUser Question: " + message }]
            }
        ]
    });

    res.json({ response: response.text });
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
