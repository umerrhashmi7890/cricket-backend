// Investigate Al sajam Abdul jabbar booking
require("dotenv").config();
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "bookings" },
);
const Booking = mongoose.model("Booking", BookingSchema);

const CourtSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "courts" },
);
const Court = mongoose.model("Court", CourtSchema);

const CustomerSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "customers" },
);
const Customer = mongoose.model("Customer", CustomerSchema);

async function investigate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Find all courts first (including archived)
    console.log("=== ALL COURTS (INCLUDING ARCHIVED) ===");
    const allCourts = await Court.find({}).sort({ createdAt: 1 }).lean();

    allCourts.forEach((court, index) => {
      console.log(
        `${index + 1}. ${court.name} (ID: ${court._id}, Status: ${court.status})`,
      );
    });

    console.log("\n=== ACTIVE COURTS ONLY ===");
    const courts = await Court.find({ status: { $ne: "archived" } })
      .sort({ createdAt: 1 })
      .lean();

    courts.forEach((court, index) => {
      console.log(`Court ${index + 1}: ${court.name} (ID: ${court._id})`);
    });

    console.log("\n=== ACTIVE COURTS SORTED ALPHABETICALLY ===");
    const sortedCourts = [...courts].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    sortedCourts.forEach((court, index) => {
      console.log(`Court ${index + 1}: ${court.name} (ID: ${court._id})`);
    });

    console.log("\n=== THURSDAY FEB 12 BOOKINGS ===\n");

    // Find all bookings for Thursday Feb 12
    const bookings = await Booking.find({
      bookingDate: {
        $gte: new Date("2026-02-12T00:00:00.000Z"),
        $lte: new Date("2026-02-12T23:59:59.999Z"),
      },
      status: { $ne: "cancelled" },
    })
      .sort({ startTime: 1 })
      .lean();

    console.log(`Found ${bookings.length} bookings for Thursday Feb 12\n`);

    for (const booking of bookings) {
      const customer = await Customer.findById(booking.customer).lean();
      const court = await Court.findById(booking.court).lean();

      console.log("---");
      console.log("Customer:", customer?.name || "Unknown");
      console.log("Court ID:", booking.court);
      console.log("Court Name:", court?.name || "Unknown");
      console.log("Start Time:", booking.startTime);
      console.log("Duration:", booking.durationHours, "hours");
      console.log("Status:", booking.status);

      // Check which court number this is
      const courtIndex = courts.findIndex(
        (c) => c._id.toString() === booking.court.toString(),
      );
      console.log(
        "Court Position:",
        courtIndex >= 0 ? `Court ${courtIndex + 1}` : "NOT FOUND",
      );
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

investigate();
