import { Request, Response, NextFunction } from "express";
import Booking from "../models/Booking";
import Court from "../models/Court";
import asyncHandler from "express-async-handler";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

// Get dashboard stats for a specific date
export const getDashboardStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    // Use UTC dates to avoid timezone issues
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Get today's bookings count
    const todaysBookingsCount = await Booking.countDocuments({
      bookingDate: {
        $gte: dayStart,
        $lte: dayEnd,
      },
      status: { $ne: "cancelled" },
    });

    // Get today's revenue
    const todaysBookings = await Booking.find({
      bookingDate: {
        $gte: dayStart,
        $lte: dayEnd,
      },
      status: { $ne: "cancelled" },
    });

    const todaysRevenue =
      Math.round(
        todaysBookings.reduce((total: number, booking: any) => {
          return total + (booking.finalPrice || 0);
        }, 0) * 100,
      ) / 100;

    // Get court utilization percentage
    const allCourts = await Court.find({ status: "active" });
    const totalSlots = allCourts.length * 19; // 19 hours from 9 AM to 4 AM (9-23=15 hours + 0-4=5 hours)

    const bookedSlots = await Booking.aggregate([
      {
        $match: {
          bookingDate: {
            $gte: dayStart,
            $lte: dayEnd,
          },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalSlots: { $sum: "$durationHours" },
        },
      },
    ]);

    const bookedCount = bookedSlots[0]?.totalSlots || 0;
    const utilization =
      totalSlots > 0 ? Math.round((bookedCount / totalSlots) * 100) : 0;

    // Get active customers count
    const activeCustomers = await Booking.countDocuments({
      bookingDate: {
        $gte: dayStart,
        $lte: dayEnd,
      },
      customerPhone: { $exists: true, $ne: null },
      status: { $ne: "cancelled" },
    });

    // Calculate percentage changes (mock for now, can be enhanced)
    const yesterday = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
    const lastDayStart = new Date(yesterday);
    lastDayStart.setUTCHours(0, 0, 0, 0);
    const lastDayEnd = new Date(yesterday);
    lastDayEnd.setUTCHours(23, 59, 59, 999);

    const lastDayBookingsCount = await Booking.countDocuments({
      bookingDate: {
        $gte: lastDayStart,
        $lte: lastDayEnd,
      },
      status: { $ne: "cancelled" },
    });

    const bookingsChange =
      lastDayBookingsCount > 0
        ? Math.round(
            ((todaysBookingsCount - lastDayBookingsCount) /
              lastDayBookingsCount) *
              100,
          )
        : 12;

    res.json({
      success: true,
      data: {
        bookings: {
          value: todaysBookingsCount,
          change: bookingsChange,
          trend: bookingsChange >= 0 ? "up" : "down",
        },
        revenue: {
          value: todaysRevenue,
          currency: "SAR",
          change: 8,
          trend: "up",
        },
        utilization: {
          value: utilization,
          change: 5,
          trend: "up",
        },
        customers: {
          value: activeCustomers,
          change: -3,
          trend: "down",
        },
      },
    });
  },
);

// Get today's bookings for dashboard
export const getDashboardBookings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      bookingDate: {
        $gte: dayStart,
        $lte: dayEnd,
      },
    })
      .populate("customer", "name phone email")
      .populate("court", "name")
      .sort({ bookingDate: -1 })
      .limit(10);

    const formattedBookings = bookings.map((booking: any) => ({
      id: booking._id,
      bookingId: booking._id.toString(),
      customer: (booking.customer as any)?.name || "Walk-in",
      court: (booking.court as any)?.name || "N/A",
      time: `${booking.startTime} - ${booking.endTime}`,
      status: booking.status,
      amount: `${booking.finalPrice} SAR`,
      paymentStatus: booking.paymentStatus,
    }));

    res.json({
      success: true,
      count: formattedBookings.length,
      data: formattedBookings,
    });
  },
);

// Get court utilization for dashboard
export const getDashboardCourtUtilization = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const courts = await Court.find({ status: "active" });

    const courtUtilization = await Promise.all(
      courts.map(async (court: any) => {
        const bookings = await Booking.find({
          court: court._id,
          bookingDate: {
            $gte: dayStart,
            $lte: dayEnd,
          },
          status: { $ne: "cancelled" },
        });

        const totalDuration = bookings.reduce(
          (sum: number, b: any) => sum + (b.durationHours || 0),
          0,
        );
        const utilization = Math.round((totalDuration / 19) * 100); // 19 hours available

        return {
          court: court.name,
          utilization: Math.min(utilization, 100),
          bookedHours: totalDuration,
          bookingsCount: bookings.length,
        };
      }),
    );

    res.json({
      success: true,
      count: courtUtilization.length,
      data: courtUtilization,
    });
  },
);

// Get revenue summary for a date range
export const getRevenueSummary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate } = req.query;

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate as string);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      // Start of current month in UTC
      const now = new Date();
      start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
      );
    }

    if (endDate) {
      end = new Date(endDate as string);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      // End of current month in UTC
      const now = new Date();
      end = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
    }

    const revenueData = await Booking.aggregate([
      {
        $match: {
          bookingDate: {
            $gte: start,
            $lte: end,
          },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" },
          },
          totalRevenue: { $sum: "$finalPrice" },
          bookingsCount: { $sum: 1 },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$finalPrice", 0],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$finalPrice", 0],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const totalRevenue = revenueData.reduce(
      (sum: number, d: any) => sum + d.totalRevenue,
      0,
    );
    const totalBookings = revenueData.reduce(
      (sum: number, d: any) => sum + d.bookingsCount,
      0,
    );
    const totalPaid = revenueData.reduce(
      (sum: number, d: any) => sum + d.paidAmount,
      0,
    );
    const totalPending = revenueData.reduce(
      (sum: number, d: any) => sum + d.pendingAmount,
      0,
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalBookings,
          totalPaid,
          totalPending,
          averageBookingValue:
            totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
        },
        daily: revenueData,
      },
    });
  },
);
