// @ts-nocheck
import mongoose from "mongoose";

const connectDB = async () => {
  mongoose.set("strictQuery", false);
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});
mongoose.connection.on("reconnected", () => {
  console.info("MongoDB reconnected");
});

export default connectDB;