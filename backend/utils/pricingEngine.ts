import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";

export const calculateDynamicSurge = async (start: Date): Promise<number> => {
  let baseMultiplier = 1;

  // 1. Time-based surge (High demand hours: 8-10 AM, 5-7 PM)
  const hour = start.getHours();
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
    baseMultiplier += 0.5; // +50%
  } else if (hour >= 23 || hour <= 5) {
    baseMultiplier += 0.25; // +25%
  }

  // 2. Supply vs Demand surge
  // Find active drivers vs pending/ongoing bookings
  try {
    const [activeDrivers, activeBookings] = await Promise.all([
      Driver.countDocuments({ isActive: true, kycStatus: "approved" }),
      Booking.countDocuments({ status: { $in: ["pending", "ongoing", "accepted"] } })
    ]);

    if (activeDrivers === 0 && activeBookings > 0) {
      baseMultiplier += 1.0; // Extreme surge, no drivers available
    } else if (activeDrivers > 0) {
      const demandRatio = activeBookings / activeDrivers;
      
      if (demandRatio > 2.0) {
        baseMultiplier += 0.8; // Very high demand
      } else if (demandRatio > 1.0) {
        baseMultiplier += 0.4; // High demand
      } else if (demandRatio > 0.5) {
        baseMultiplier += 0.1; // Moderate demand
      }
    }
  } catch (error) {
    console.error("Error calculating dynamic surge:", error);
  }

  // Cap surge at 3.0x
  return Math.min(baseMultiplier, 3.0);
};
