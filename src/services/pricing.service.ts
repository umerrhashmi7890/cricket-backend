import PricingRule from "../models/PricingRule";
import { ITimeSlotPrice, IPriceCalculation } from "../types/pricing.types";
import { BadRequestError } from "../utils/ApiError";

export class PricingService {
  /**
   * Get day of week (0 = Sunday, 6 = Saturday)
   */
  private static getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  /**
   * Get days specification for a date (sun-wed, thu, fri, sat)
   */
  private static getDays(date: Date): "sun-wed" | "thu" | "fri" | "sat" {
    const day = this.getDayOfWeek(date);
    if (day === 0 || day === 1 || day === 2 || day === 3) return "sun-wed"; // Sun-Wed
    if (day === 4) return "thu"; // Thursday
    if (day === 5) return "fri"; // Friday
    return "sat"; // Saturday
  }

  /**
   * Get category for pricing
   */
  private static getCategory(
    days: "sun-wed" | "thu" | "fri" | "sat",
    timeSlot: "day" | "night",
  ): "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night" {
    // Sun-Wed day = weekday-day (90)
    if (days === "sun-wed" && timeSlot === "day") return "weekday-day";
    // Sun-Wed night = weekday-night (110)
    if (days === "sun-wed" && timeSlot === "night") return "weekday-night";
    // Thu day = weekday-day (90)
    if (days === "thu" && timeSlot === "day") return "weekday-day";
    // Thu night = weekend-night (135)
    if (days === "thu" && timeSlot === "night") return "weekend-night";
    // Fri day = weekend-day (110)
    if (days === "fri" && timeSlot === "day") return "weekend-day";
    // Fri night = weekend-night (135)
    if (days === "fri" && timeSlot === "night") return "weekend-night";
    // Sat day = weekend-day (110)
    if (days === "sat" && timeSlot === "day") return "weekend-day";
    // Sat night = weekday-night (110)
    return "weekday-night";
  }

  /**
   * Check if time is night slot (7 PM to 9 AM)
   * Night: 19:00 (7 PM) to 09:00 (9 AM) next day
   */
  private static isNightTime(hour: number): boolean {
    return hour >= 19 || hour < 9;
  }

  /**
   * Get time slot for a specific hour
   */
  private static getTimeSlot(hour: number): "day" | "night" {
    return this.isNightTime(hour) ? "night" : "day";
  }

  /**
   * Handle midnight boundary (12 AM - 4 AM belongs to previous day)
   * IMPORTANT: When calculating booking prices, early morning slots (00:00-04:00)
   * should use the BOOKING DATE'S pricing, not the previous day.
   * This function is ONLY for determining if a standalone datetime belongs to the previous day.
   * For booking price calculations, pass the original booking date directly.
   */
  private static getEffectiveDate(date: Date, bookingDate?: Date): Date {
    const hour = date.getHours();

    if (hour >= 0 && hour < 4) {
      const effectiveDate = new Date(date);
      effectiveDate.setDate(effectiveDate.getDate() - 1);

      // If bookingDate provided, check if this slot is on the SAME calendar day as booking
      // Example: Booking Thursday for 02:00 slots → date is Thursday 02:00
      // After rewinding: Wednesday → but original date is Thursday → use Thursday
      // BUT: If booking Thursday 23:00-01:00, the 01:00 slot is Friday → after rewinding: Thursday → correct!
      if (bookingDate) {
        const bookingDay = bookingDate.getDate();
        const slotDay = date.getDate(); // Original date BEFORE rewinding

        // If the slot's calendar day matches booking day, user selected this directly
        // (not a midnight crossing), so use booking date for pricing
        if (slotDay === bookingDay) {
          return bookingDate;
        }
      }

      return effectiveDate;
    }
    return date;
  }

  /**
   * Get price for a specific time slot
   */
  private static async getPrice(
    date: Date,
    hour: number,
    bookingDate?: Date,
  ): Promise<{
    price: number;
    days: "sun-wed" | "thu" | "fri" | "sat";
    category: "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night";
    timeSlot: "day" | "night";
  }> {
    const effectiveDate = this.getEffectiveDate(date, bookingDate);
    const days = this.getDays(effectiveDate);
    const timeSlot = this.getTimeSlot(hour);
    const category = this.getCategory(days, timeSlot);

    // Fetch pricing rule from database
    const pricingRule = await PricingRule.findOne({
      days,
      timeSlot,
      isActive: true,
    });

    if (!pricingRule) {
      throw new BadRequestError(
        `Pricing rule not found for ${days} ${timeSlot}`,
      );
    }

    return {
      price: pricingRule.pricePerHour,
      days,
      category,
      timeSlot,
    };
  }

  /**
   * Calculate booking price with detailed breakdown
   * @param bookingDate - Date object or string for the booking date
   * @param startTime - Time string in HH:MM format (e.g., "18:00")
   * @param endTime - Time string in HH:MM format (e.g., "20:00")
   */
  static async calculateBookingPrice(
    bookingDate: Date | string,
    startTime: string,
    endTime: string,
  ): Promise<{
    totalHours: number;
    breakdown: Array<{
      hour: string;
      rate: number;
      days: "sun-wed" | "thu" | "fri" | "sat";
      category:
        | "weekday-day"
        | "weekday-night"
        | "weekend-day"
        | "weekend-night";
      timeSlot: "day" | "night";
    }>;
    finalPrice: number;
  }> {
    // Parse date
    const dateObj =
      typeof bookingDate === "string" ? new Date(bookingDate) : bookingDate;
    dateObj.setHours(0, 0, 0, 0);

    // Parse times
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    // Create full datetime objects
    const startDateTime = new Date(dateObj);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(dateObj);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle midnight crossing (e.g., 23:00 to 02:00)
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    // Validate times
    const totalMilliseconds = endDateTime.getTime() - startDateTime.getTime();
    const totalHours = totalMilliseconds / (1000 * 60 * 60);

    // Check minimum 1 hour
    if (totalHours < 1) {
      throw new BadRequestError("Minimum booking duration is 1 hour");
    }

    // Check 30-minute increments
    const minutes = (totalMilliseconds / (1000 * 60)) % 60;
    if (minutes !== 0 && minutes !== 30) {
      throw new BadRequestError(
        "Bookings must be in 30-minute increments (e.g., 1.0h, 1.5h, 2.0h)",
      );
    }

    const breakdown: Array<{
      hour: string;
      rate: number;
      days: "sun-wed" | "thu" | "fri" | "sat";
      category:
        | "weekday-day"
        | "weekday-night"
        | "weekend-day"
        | "weekend-night";
      timeSlot: "day" | "night";
    }> = [];
    let currentTime = new Date(startDateTime);
    let totalPrice = 0;

    // Calculate price for each hour
    while (currentTime < endDateTime) {
      const nextHour = new Date(currentTime);
      nextHour.setHours(nextHour.getHours() + 1);

      // Don't go beyond end time
      const slotEnd = nextHour > endDateTime ? endDateTime : nextHour;
      const slotDuration =
        (slotEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      const { price, days, category, timeSlot } = await this.getPrice(
        currentTime,
        currentTime.getHours(),
        dateObj, // Pass original booking date for correct pricing of early morning slots
      );

      const slotPrice = price * slotDuration;
      totalPrice += slotPrice;

      // Format hour range for breakdown
      const startStr = `${String(currentTime.getHours()).padStart(
        2,
        "0",
      )}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
      const endStr = `${String(slotEnd.getHours()).padStart(2, "0")}:${String(
        slotEnd.getMinutes(),
      ).padStart(2, "0")}`;

      breakdown.push({
        hour: `${startStr}-${endStr}`,
        rate: price,
        days,
        category,
        timeSlot,
      });

      currentTime = slotEnd;
    }

    return {
      totalHours,
      breakdown,
      finalPrice: totalPrice,
    };
  }
}
