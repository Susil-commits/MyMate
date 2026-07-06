export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

export const formatINR = (amount) => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
};

export const getImageUrl = (licenseImage) => {
  if (!licenseImage) return "";
  if (typeof licenseImage === "string") return licenseImage;
  return licenseImage.url || "";
};

export const hireTypes = [
  { value: "temporary", label: "Temporary" },
  { value: "permanent", label: "Permanent" },
];

export const vehicleTypes = ["Car", "SUV", "Van", "Truck", "Bus", "Auto", "Bike"];

export const bookingStatusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  ongoing: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export const paymentStatusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-purple-100 text-purple-800",
};