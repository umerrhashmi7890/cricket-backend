import mongoose from "mongoose";

export const connectDatabase = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/cricket-booking";

    await mongoose.connect(mongoUri);

    console.log("✅ MongoDB server connected successfully");
    console.log(
      `📦 Database: ${mongoose.connection.name} (will be created on first data insertion)`
    );
    console.log(
      `🔗 Connection: ${mongoUri.split("@")[1] || mongoUri.split("//")[1]}`
    );
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.log("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("❌ MongoDB error:", error);
});
