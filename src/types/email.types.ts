export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface BookingConfirmationEmailData {
  customerName: string;
  bookingId: string;
  courtName: string;
  bookingDate: string; // formatted date like "Saturday, January 25, 2026"
  startTime: string; // "18:00"
  endTime: string; // "21:00"
  durationHours: number;
  totalPrice: number;
  amountPaid: number;
  paymentStatus: "pending" | "partial" | "paid";
  paymentMethod?: string;
  customerEmail?: string;
  customerPhone: string;
}

export interface BookingCancellationEmailData {
  customerName: string;
  bookingId: string;
  courtName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  refundAmount?: number;
  cancellationReason?: string;
}

export interface PaymentReceiptEmailData extends BookingConfirmationEmailData {
  paymentReference?: string;
  paymentDate: string;
}
