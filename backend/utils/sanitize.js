const PUBLIC_DRIVER_FIELDS = [
  "_id",
  "name",
  "locality",
  "nationality",
  "availability",
  "averageRating",
  "totalReviews",
  "experienceYears",
  "vehicleTypes",
  "hourlyRate",
  "dailyRate",
  "languages",
  "bio",
  "kycStatus",
  "avatar",
  "createdAt",
];

export const sanitizeDriver = (driver, { withContact = false } = {}) => {
  if (!driver) return null;
  const src = typeof driver.toObject === "function" ? driver.toObject() : driver;
  const out = {};
  PUBLIC_DRIVER_FIELDS.forEach((field) => {
    if (src[field] !== undefined) out[field] = src[field];
  });
  out.documentsVerified = src.kycStatus === "approved";
  if (withContact && src.phone) out.phone = src.phone;
  return out;
};

export const clampLimit = (value, defaultValue = 10, max = 50) => {
  const n = Number(value) || defaultValue;
  return Math.min(Math.max(Math.floor(n), 1), max);
};
