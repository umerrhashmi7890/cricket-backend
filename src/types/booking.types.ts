export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show"
  | "blocked";

export type PaymentStatus = "pending" | "partial" | "paid" | "refunded";

export type CreatedBy = "customer" | "admin";

export interface PricingBreakdownItem {
  hour: string; // "18:00-19:00"
  rate: number;
  dayType: "weekday" | "weekend";
  timeSlot: "day" | "night";
}

export interface IBooking {
  customer?: string; // ObjectId as string, optional for blocked bookings
  court: string; // ObjectId as string
  bookingDate: Date;
  startTime: string; // "18:00"
  endTime: string; // "20:00"
  durationHours: number;

  // Pricing
  totalPrice: number;
  pricingBreakdown: PricingBreakdownItem[];
  promoCode?: string; // ObjectId as string, for future
  discountAmount: number;
  finalPrice: number;

  // Payment
  paymentStatus: PaymentStatus;
  amountPaid: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentId?: string; // Moyasar payment ID for duplicate prevention

  // Status
  status: BookingStatus;

  // Additional
  notes?: string;
  createdBy: CreatedBy;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingDTO {
  courtId: string;
  bookingDate: string | Date;
  startTime: string;
  endTime: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  notes?: string;
  promoCode?: string; // Promo code string (e.g., "WELCOME20")
  paymentId?: string; // Moyasar payment ID
  paymentStatus?: string; // Payment status (paid, pending, etc.)
  amountPaid?: number; // Amount paid in SAR
}

export interface CreateManualBookingDTO {
  courtId: string;
  bookingDate: string | Date;
  startTime: string;
  endTime: string;
  customerPhone?: string; // Optional for blocked bookings
  customerName?: string;
  customerEmail?: string;
  notes?: string;
  isBlocked?: boolean; // If true, creates a blocked booking
  promoCode?: string; // Admin can apply promo codes
}

export interface CheckAvailabilityDTO {
  courtId: string;
  bookingDate: string | Date;
  startTime: string;
  endTime: string;
  excludeBookingId?: string; // For update scenario
}

export interface AvailabilityResult {
  available: boolean;
  conflicts?: Array<{
    bookingId: string;
    startTime: string;
    endTime: string;
    status: BookingStatus;
  }>;
}

export interface UpdateBookingStatusDTO {
  status: BookingStatus;
  notes?: string;
}

export interface UpdatePaymentDTO {
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;
}

export interface BookingFilters {
  courtId?: string;
  customerId?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  startDate?: string | Date;
  endDate?: string | Date;
  createdBy?: CreatedBy;
}

export interface BatchAvailabilityDTO {
  bookingDate: string | Date;
  timeSlots: Array<{
    startTime: string;
    endTime: string;
  }>;
  courtIds?: string[]; // Optional: check specific courts, or all active if not provided
}

export interface BatchAvailabilityResult {
  [courtId: string]: {
    [timeSlotKey: string]: {
      available: boolean;
      startTime: string;
      endTime: string;
    };
  };
}
