// Simulate exactly what the frontend receives
require("dotenv").config();
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {},
  { strict: false, strictPopulate: false, collection: "bookings" },
);
const Booking = mongoose.model("Booking", BookingSchema);

const CourtSchema = new mongoose.Schema(
  {},
  { strict: false, strictPopulate: false, collection: "courts" },
);
const Court = mongoose.model("Court", CourtSchema);

async function simulateFrontend() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // STEP 1: Get courts (same as frontend)
    console.log("=== STEP 1: COURTS FETCHED BY FRONTEND ===");
    const courtsData = await Court.find({}).sort({ createdAt: 1 }).lean();

    // Sort alphabetically (same as frontend)
    const courts = courtsData.sort((a, b) => a.name.localeCompare(b.name));

    courts.forEach((court, index) => {
      console.log(`Position ${index}: ${court.name}`);
      console.log(`  ID: ${court._id}`);
    });

    // STEP 2: Get bookings for Feb 12 (same as backend endpoint)
    console.log("\n=== STEP 2: BOOKINGS FETCHED FROM BACKEND ===");
    const start = new Date("2026-02-12T00:00:00.000Z");
    const end = new Date("2026-02-12T23:59:59.999Z");

    const bookings = await Booking.find({
      bookingDate: { $gte: start, $lte: end },
      status: { $ne: "cancelled" },
    })
      .populate("customer", "name")
      .populate("court", "name")
      .sort({ bookingDate: 1, startTime: 1 })
      .lean();

    // Map to frontend format (same as backend controller)
    const result = bookings.map((b) => {
      const courtId = b.court?._id?.toString?.() || b.court;
      const courtName = b.court?.name || null;
      const startHour = parseInt(b.startTime.split(":")[0], 10);

      return {
        id: b._id,
        bookingId: b._id,
        courtId,
        courtName,
        bookingDate: b.bookingDate,
        startHour,
        duration: b.durationHours,
        customer: b.customer?.name || "Guest",
        status: b.status,
        amount: `${b.finalPrice ?? b.totalPrice ?? 0} SAR`,
      };
    });

    console.log(`\nFound ${result.length} bookings\n`);

    // STEP 3: Simulate rendering for 21:00 hour
    console.log("=== STEP 3: RENDERING LOGIC FOR 21:00 HOUR ===\n");

    courts.forEach((court, courtIndex) => {
      // This is what getBookingForSlot does
      const booking = result.find(
        (b) => b.courtId === court._id.toString() && b.startHour === 21,
      );

      if (booking) {
        console.log(`Court Position ${courtIndex} (${court.name}):`);
        console.log(`  Booking Found: ${booking.customer}`);
        console.log(`  Booking courtId: ${booking.courtId}`);
        console.log(`  Court _id: ${court._id}`);
        console.log(`  Match: ${booking.courtId === court._id.toString()}`);
        console.log();
      }
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

simulateFrontend();
