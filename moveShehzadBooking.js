// Move Shehzad akbar's booking earlier to avoid overlap
require("dotenv").config();
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {},
  { strict: false, strictPopulate: false, collection: "bookings" },
);
const Booking = mongoose.model("Booking", BookingSchema);

const CustomerSchema = new mongoose.Schema(
  {},
  { strict: false, strictPopulate: false, collection: "customers" },
);
const Customer = mongoose.model("Customer", CustomerSchema);

async function moveBooking() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Find shehzad akbar's customer
    const customer = await Customer.findOne({
      name: { $regex: /shehzad akbar/i },
    }).lean();

    if (!customer) {
      console.log("Customer 'shehzad akbar' not found");
      await mongoose.disconnect();
      return;
    }

    console.log("Found customer:", customer.name);
    console.log("Customer ID:", customer._id);

    // Find the booking on Feb 12 at 20:00
    const booking = await Booking.findOne({
      customer: customer._id,
      bookingDate: {
        $gte: new Date("2026-02-12T00:00:00.000Z"),
        $lte: new Date("2026-02-12T23:59:59.999Z"),
      },
      startTime: "20:00",
    }).lean();

    if (!booking) {
      console.log("Booking not found for Feb 12 at 20:00");
      await mongoose.disconnect();
      return;
    }

    console.log("\nCurrent Booking:");
    console.log("  Start Time:", booking.startTime);
    console.log("  End Time:", booking.endTime);
    console.log("  Duration:", booking.durationHours, "hours");

    // Move booking to 18:00-20:00 (2 hours earlier)
    const newStartTime = "18:00";
    const newEndTime = "20:00";

    console.log("\nMoving booking to:");
    console.log("  New Start Time:", newStartTime);
    console.log("  New End Time:", newEndTime);
    console.log("  This removes overlap with Al sajam (21:00-23:00)");

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      },
    );

    console.log("\n✅ Booking updated successfully!");

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

moveBooking();
