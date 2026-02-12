// Quick script to check booking dates in database
require("dotenv").config();
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "bookings" },
);
const Booking = mongoose.model("Booking", BookingSchema);

async function checkDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Get all Feb 11 bookings (any that might be Feb 11)
    const bookings = await Booking.find({
      bookingDate: {
        $gte: new Date("2026-02-10T00:00:00.000Z"),
        $lte: new Date("2026-02-12T23:59:59.999Z"),
      },
      status: { $ne: "cancelled" },
    })
      .sort({ bookingDate: 1, startTime: 1 })
      .lean();

    console.log(`Found ${bookings.length} bookings\n`);

    bookings.forEach((b) => {
      const date = new Date(b.bookingDate);
      console.log("---");
      console.log("Customer:", b.customer);
      console.log("Court:", b.court);
      console.log("Time:", b.startTime);
      console.log("bookingDate (stored in DB):", date.toISOString());
      console.log("Date in UTC:", date.toUTCString());
      console.log(
        "Date in Saudi Arabia (UTC+3):",
        date.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }),
      );
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDates();
