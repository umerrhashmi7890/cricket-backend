// Fix malformed booking dates that include time components
require("dotenv").config();
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "bookings" },
);
const Booking = mongoose.model("Booking", BookingSchema);

async function fixDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Find all bookings with time components (not midnight UTC)
    const allBookings = await Booking.find({}).lean();

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const booking of allBookings) {
      const date = new Date(booking.bookingDate);

      // Check if date has time component (not midnight UTC)
      if (
        date.getUTCHours() !== 0 ||
        date.getUTCMinutes() !== 0 ||
        date.getUTCSeconds() !== 0
      ) {
        // This booking has a time component - needs fixing
        // Extract the calendar date it represents in Saudi Arabia (UTC+3)
        const saudiDate = new Date(
          date.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }),
        );

        // Create correct UTC date at midnight
        const correctedDate = new Date(
          Date.UTC(
            saudiDate.getFullYear(),
            saudiDate.getMonth(),
            saudiDate.getDate(),
            0,
            0,
            0,
            0,
          ),
        );

        console.log(`Fixing booking ${booking._id}:`);
        console.log(
          `  Old: ${date.toISOString()} (${date.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })} Saudi Time)`,
        );
        console.log(
          `  New: ${correctedDate.toISOString()} (${correctedDate.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })} Saudi Time)`,
        );

        await Booking.updateOne(
          { _id: booking._id },
          { $set: { bookingDate: correctedDate } },
        );

        fixed++;
      } else {
        alreadyCorrect++;
      }
    }

    console.log(`\n✅ Fixed: ${fixed} bookings`);
    console.log(`✅ Already correct: ${alreadyCorrect} bookings`);
    console.log(`📊 Total: ${allBookings.length} bookings`);

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixDates();
