import Booking from "../models/Booking";
import {
  CheckAvailabilityDTO,
  AvailabilityResult,
  BatchAvailabilityDTO,
  BatchAvailabilityResult,
} from "../types/booking.types";
import { ApiError } from "../utils/ApiError";

export class BookingService {
  /**
   * Check if a time slot is available for booking
   */
  static async checkAvailability(
    data: CheckAvailabilityDTO,
  ): Promise<AvailabilityResult> {
    const { courtId, bookingDate, startTime, endTime, excludeBookingId } = data;

    // Validate time format
    this.validateTimeFormat(startTime);
    this.validateTimeFormat(endTime);

    // Convert times to minutes for easier comparison
    const requestStartMinutes = this.timeToMinutes(startTime);
    const requestEndMinutes = this.timeToMinutes(endTime);

    // Handle midnight boundary (e.g., 23:00 to 02:00)
    const crossesMidnight = requestEndMinutes < requestStartMinutes;

    // Normalize booking date to start of day
    const dateObj = new Date(bookingDate);
    dateObj.setHours(0, 0, 0, 0);

    // Find all bookings for this court on this date that are not cancelled
    const query: any = {
      court: courtId,
      bookingDate: dateObj,
      status: { $nin: ["cancelled"] }, // Exclude cancelled bookings
    };

    // Exclude specific booking ID if provided (for update scenario)
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const existingBookings = await Booking.find(query).select(
      "startTime endTime status",
    );

    // Check for conflicts
    const conflicts: AvailabilityResult["conflicts"] = [];

    for (const booking of existingBookings) {
      const bookingStartMinutes = this.timeToMinutes(booking.startTime);
      const bookingEndMinutes = this.timeToMinutes(booking.endTime);
      const bookingCrossesMidnight = bookingEndMinutes < bookingStartMinutes;

      // Check for overlap
      if (
        this.timeSlotsOverlap(
          requestStartMinutes,
          requestEndMinutes,
          crossesMidnight,
          bookingStartMinutes,
          bookingEndMinutes,
          bookingCrossesMidnight,
        )
      ) {
        conflicts.push({
          bookingId: booking._id.toString(),
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
        });
      }
    }

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Check availability for multiple courts and time slots in a single call
   * This is optimized to reduce database queries from N*M to 1
   */
  static async checkBatchAvailability(
    data: BatchAvailabilityDTO,
  ): Promise<BatchAvailabilityResult> {
    const { bookingDate, timeSlots, courtIds } = data;

    // Validate time formats
    for (const slot of timeSlots) {
      this.validateTimeFormat(slot.startTime);
      this.validateTimeFormat(slot.endTime);
    }

    // Normalize booking date to start of day
    const dateObj = new Date(bookingDate);
    dateObj.setHours(0, 0, 0, 0);

    // Also create end of day for range query
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Build query for all bookings on this date
    const query: any = {
      bookingDate: {
        $gte: dateObj,
        $lte: endOfDay,
      },
      status: { $nin: ["cancelled"] }, // Exclude cancelled bookings
    };

    // If specific courts requested, filter by them
    if (courtIds && courtIds.length > 0) {
      query.court = { $in: courtIds };
    }

    // Single database query to fetch all relevant bookings
    const existingBookings = await Booking.find(query).select(
      "court startTime endTime status",
    );

    // Build a map of court -> bookings for faster lookups
    const courtBookingsMap = new Map<string, typeof existingBookings>();
    for (const booking of existingBookings) {
      const courtId = booking.court.toString();
      if (!courtBookingsMap.has(courtId)) {
        courtBookingsMap.set(courtId, []);
      }
      courtBookingsMap.get(courtId)!.push(booking);
    }

    // Get all court IDs to check
    const courtsToCheck = courtIds || Array.from(courtBookingsMap.keys());

    // Build the result object
    const result: BatchAvailabilityResult = {};

    // Check each court and time slot combination
    for (const courtId of courtsToCheck) {
      result[courtId] = {};

      const courtBookings = courtBookingsMap.get(courtId) || [];

      for (const slot of timeSlots) {
        const timeSlotKey = `${slot.startTime}-${slot.endTime}`;

        // Convert times to minutes
        const requestStartMinutes = this.timeToMinutes(slot.startTime);
        const requestEndMinutes = this.timeToMinutes(slot.endTime);
        const crossesMidnight = requestEndMinutes < requestStartMinutes;

        // Check for conflicts with existing bookings
        let hasConflict = false;
        for (const booking of courtBookings) {
          const bookingStartMinutes = this.timeToMinutes(booking.startTime);
          const bookingEndMinutes = this.timeToMinutes(booking.endTime);
          const bookingCrossesMidnight =
            bookingEndMinutes < bookingStartMinutes;

          if (
            this.timeSlotsOverlap(
              requestStartMinutes,
              requestEndMinutes,
              crossesMidnight,
              bookingStartMinutes,
              bookingEndMinutes,
              bookingCrossesMidnight,
            )
          ) {
            hasConflict = true;
            break;
          }
        }

        result[courtId][timeSlotKey] = {
          available: !hasConflict,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      }
    }

    return result;
  }

  /**
   * Check if two time slots overlap
   */
  private static timeSlotsOverlap(
    start1: number,
    end1: number,
    crosses1: boolean,
    start2: number,
    end2: number,
    crosses2: boolean,
  ): boolean {
    // Handle normal case (no midnight crossing)
    if (!crosses1 && !crosses2) {
      // Classic overlap check: (StartA < EndB) and (EndA > StartB)
      return start1 < end2 && end1 > start2;
    }

    // If slot 1 crosses midnight (e.g., 23:00-02:00)
    if (crosses1 && !crosses2) {
      // Slot 1 occupies: [start1, 24:00) and [00:00, end1)
      // Slot 2 occupies: [start2, end2)

      // Check if slot 2 overlaps with first part [start1, 24:00)
      if (start2 >= start1) return true;

      // Check if slot 2 overlaps with second part [00:00, end1)
      if (end2 <= end1) return true;

      return false;
    }

    // If slot 2 crosses midnight
    if (!crosses1 && crosses2) {
      // Reverse the check
      return this.timeSlotsOverlap(
        start2,
        end2,
        crosses2,
        start1,
        end1,
        crosses1,
      );
    }

    // Both cross midnight - they definitely overlap
    return true;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Validate time format (HH:MM)
   */
  private static validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new ApiError(400, `Invalid time format: ${time}. Expected HH:MM`);
    }
  }

  /**
   * Validate booking time constraints
   */
  static validateBookingTime(
    startTime: string,
    endTime: string,
    bookingDate: Date,
  ): void {
    // Validate time format
    this.validateTimeFormat(startTime);
    this.validateTimeFormat(endTime);

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    // Check if crosses midnight
    const crossesMidnight = endMinutes < startMinutes;

    // Calculate duration
    let durationMinutes: number;
    if (crossesMidnight) {
      // Duration = (24:00 - start) + end
      durationMinutes = 24 * 60 - startMinutes + endMinutes;
    } else {
      durationMinutes = endMinutes - startMinutes;
    }

    // Validate minimum duration (1 hour = 60 minutes)
    if (durationMinutes < 60) {
      throw new ApiError(400, "Booking duration must be at least 1 hour");
    }

    // Validate 30-minute increments
    if (durationMinutes % 30 !== 0) {
      throw new ApiError(
        400,
        "Booking duration must be in 30-minute increments",
      );
    }

    // Validate operating hours (9:00 AM to 4:00 AM)
    // Operating hours: 9:00 (540 min) to 4:00 next day (240 min)
    const operatingStart = 9 * 60; // 9:00 AM = 540 minutes
    const operatingEnd = 4 * 60; // 4:00 AM = 240 minutes

    // Start time must be between 9:00 AM and 3:59 AM (next day)
    // This means: startMinutes >= 540 OR startMinutes < 240
    if (!(startMinutes >= operatingStart || startMinutes < operatingEnd)) {
      throw new ApiError(
        400,
        "Booking start time must be between 9:00 AM and 4:00 AM",
      );
    }

    // End time validation
    if (crossesMidnight) {
      // End time is next day, must be at or before 4:00 AM
      if (endMinutes > operatingEnd) {
        throw new ApiError(400, "Booking cannot end after 4:00 AM");
      }
    } else {
      // End time is same day
      // Must be after 9:00 AM (operating start) if booking is same day
      if (startMinutes >= operatingStart && endMinutes <= operatingStart) {
        throw new ApiError(400, "Invalid booking time");
      }
    }

    // Validate booking date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDateObj = new Date(bookingDate);
    bookingDateObj.setHours(0, 0, 0, 0);

    if (bookingDateObj < today) {
      throw new ApiError(400, "Cannot book in the past");
    }
  }

  /**
   * Calculate duration in hours from start and end time
   */
  static calculateDuration(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    let durationMinutes: number;
    if (endMinutes < startMinutes) {
      // Crosses midnight
      durationMinutes = 24 * 60 - startMinutes + endMinutes;
    } else {
      durationMinutes = endMinutes - startMinutes;
    }

    return durationMinutes / 60; // Convert to hours
  }
  /**
   * Update booking status and payment information
   */
  static async updateBookingStatus(
    bookingId: string,
    status: string,
    paymentInfo?: {
      paymentId?: string;
      paymentStatus?: string;
      paidAmount?: number;
    },
  ): Promise<any> {
    const updateData: any = { status };

    if (paymentInfo) {
      if (paymentInfo.paymentId) {
        updateData.paymentId = paymentInfo.paymentId;
      }
      if (paymentInfo.paymentStatus) {
        updateData.paymentStatus = paymentInfo.paymentStatus;
      }
      if (paymentInfo.paidAmount !== undefined) {
        updateData.paidAmount = paymentInfo.paidAmount;
      }
    }

    const booking = await Booking.findByIdAndUpdate(bookingId, updateData, {
      new: true,
    });

    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    return booking;
  }
}
