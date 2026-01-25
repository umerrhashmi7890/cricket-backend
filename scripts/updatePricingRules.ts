import mongoose from "mongoose";
import PricingRule from "../src/models/PricingRule";
import dotenv from "dotenv";

dotenv.config();

async function updatePricingRules() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jeddah-nets",
    );
    console.log("✅ Connected to MongoDB");

    // Clear existing pricing rules
    await PricingRule.deleteMany({});
    console.log("🗑️  Cleared existing pricing rules");

    // Create new pricing rules according to client requirements
    const pricingRules = [
      // Sunday-Wednesday (Weekday)
      {
        dayType: "weekday",
        timeSlot: "day",
        pricePerHour: 90,
        isActive: true,
      },
      {
        dayType: "weekday",
        timeSlot: "night",
        pricePerHour: 110,
        isActive: true,
      },
      // Thursday-Friday (Weekend) - Thursday & Friday nights are special
      {
        dayType: "weekend",
        timeSlot: "day",
        pricePerHour: 110,
        isActive: true,
      },
      {
        dayType: "weekend",
        timeSlot: "night",
        pricePerHour: 135,
        isActive: true,
      },
    ];

    // Insert all pricing rules
    const inserted = await PricingRule.insertMany(pricingRules);
    console.log(`✅ Inserted ${inserted.length} pricing rules:`);
    inserted.forEach((rule) => {
      console.log(
        `   - ${rule.dayType} ${rule.timeSlot}: ${rule.pricePerHour} SAR/hr`,
      );
    });

    console.log(
      "\n📋 Pricing Rules Summary (according to client requirements):",
    );
    console.log("   Sunday-Wednesday 9 AM - 7 PM (Day):     90 SAR/hr");
    console.log("   Sunday-Wednesday 7 PM - 4 AM (Night):  110 SAR/hr");
    console.log("   Thursday 9 AM - 7 PM (Day):             90 SAR/hr");
    console.log(
      "   Thursday 7 PM - 4 AM (Night):          135 SAR/hr ⭐ Weekend",
    );
    console.log("   Friday 9 AM - 7 PM (Day):              110 SAR/hr");
    console.log(
      "   Friday 7 PM - 4 AM (Night):            135 SAR/hr ⭐ Weekend",
    );
    console.log("   Saturday 9 AM - 7 PM (Day):            110 SAR/hr");
    console.log(
      "   Saturday 7 PM - 4 AM (Night):          110 SAR/hr (Weekday Night)",
    );

    await mongoose.disconnect();
    console.log("\n✅ Database updated successfully!");
  } catch (error) {
    console.error("❌ Error updating pricing rules:", error);
    process.exit(1);
  }
}

updatePricingRules();
