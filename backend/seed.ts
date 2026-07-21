import "dotenv/config";
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import User from "./models/User.js";
import Driver from "./models/Driver.js";
import Booking from "./models/Booking.js";
import connectDB from "./config/db.js";

async function seedData() {
  try {
    await connectDB();
    console.log("Connected to DB, starting seed...");

    // Clear existing data to avoid cluttering and duplicates in test environment
    await User.deleteMany({});
    await Driver.deleteMany({});
    await Booking.deleteMany({});
    console.log("Cleared existing users, drivers, and bookings.");

    const users = [];
    for (let i = 0; i < 50; i++) {
      users.push({
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: "password123", // Will be hashed by pre-save hook in real app but for bulk inserting it might be better to just set it or use create
        phone: faker.phone.number(),
        locality: faker.location.city(),
        profileCompleted: true,
        isActive: true,
        isEmailVerified: true,
        role: "user",
      });
    }

    // Use create so pre-save hooks (like password hashing) run
    const createdUsers = await User.create(users);
    console.log(`Created ${createdUsers.length} users.`);

    const drivers = [];
    const vehicleTypes = ["Car", "SUV", "Van", "Truck", "Bus", "Auto", "Bike"];
    for (let i = 0; i < 50; i++) {
      drivers.push({
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: "password123",
        phone: faker.phone.number(),
        locality: faker.location.city(),
        licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
        experienceYears: faker.number.int({ min: 1, max: 20 }),
        vehicleTypes: [faker.helpers.arrayElement(vehicleTypes)],
        availability: "available",
        hourlyRate: faker.number.int({ min: 10, max: 100 }),
        dailyRate: faker.number.int({ min: 80, max: 500 }),
        profileCompleted: true,
        kycStatus: "approved",
        isActive: true,
        isEmailVerified: true,
        averageRating: faker.number.float({ min: 3, max: 5, multipleOf: 0.1 }),
        totalReviews: faker.number.int({ min: 0, max: 100 }),
        role: "driver",
      });
    }

    const createdDrivers = await Driver.create(drivers);
    console.log(`Created ${createdDrivers.length} drivers.`);

    const bookings = [];
    for (let i = 0; i < 100; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      const driver = faker.helpers.arrayElement(createdDrivers);
      const hireType = faker.helpers.arrayElement(["temporary", "permanent"]);
      const status = faker.helpers.arrayElement(["pending", "accepted", "completed", "cancelled"]);
      
      bookings.push({
        user: user._id,
        driver: driver._id,
        hireType,
        status,
        startDate: faker.date.recent({ days: 30 }),
        pickupLocation: faker.location.streetAddress(),
        dropLocation: faker.location.streetAddress(),
        purpose: faker.lorem.sentence(),
        totalAmount: faker.number.int({ min: 50, max: 1000 }),
        paymentStatus: faker.helpers.arrayElement(["pending", "paid"]),
      });
    }

    const createdBookings = await Booking.create(bookings);
    console.log(`Created ${createdBookings.length} bookings.`);

    console.log("Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedData();
