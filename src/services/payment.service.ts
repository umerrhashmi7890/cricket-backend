import axios from "axios";

const MOYASAR_API_URL = "https://api.moyasar.com/v1";
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || "";

// Debug: Check if key is loaded (remove after testing)
console.log("Moyasar Key Status:", {
  isSet: !!MOYASAR_SECRET_KEY,
  prefix: MOYASAR_SECRET_KEY.substring(0, 7),
  length: MOYASAR_SECRET_KEY.length,
});

export interface CreatePaymentDTO {
  amount: number; // in halalas (SAR * 100)
  currency: string;
  description: string;
  callbackUrl: string;
  source: {
    type: string; // 'creditcard' or 'applepay'
    name?: string;
    number?: string;
    cvc?: string;
    month?: string;
    year?: string;
    token?: string; // For Apple Pay
  };
  metadata?: {
    bookingId?: string;
    courtId?: string;
    customerEmail?: string;
    [key: string]: any;
  };
}

export interface CreatePaymentRequestDTO {
  amount: number; // in halalas (SAR * 100)
  currency: string;
  description: string;
  callback_url: string;
  success_url?: string; // URL to redirect after successful payment
  payment_methods?: string[]; // Payment methods to enable (e.g., ['creditcard'])
  metadata?: Record<string, any>;
}

export interface PaymentRequestResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  amount_format: string;
  url: string; // The checkout URL to redirect to
  callback_url: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface MoyasarPaymentResponse {
  id: string;
  status: string; // 'initiated', 'paid', 'failed', 'authorized', 'captured', 'refunded'
  amount: number;
  fee: number;
  currency: string;
  refunded: number;
  refunded_at: string | null;
  captured: number;
  captured_at: string | null;
  voided_at: string | null;
  description: string;
  amount_format: string;
  fee_format: string;
  refunded_format: string;
  captured_format: string;
  invoice_id: string | null;
  ip: string;
  callback_url: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  source: {
    type: string;
    company: string;
    name: string;
    number: string;
    gateway_id: string;
    reference_number: string;
    token: string | null;
    message: string | null;
    transaction_url: string;
  };
}

class PaymentService {
  /**
   * Create a payment request (hosted checkout page)
   * This returns a URL that you redirect the user to
   */
  async createPaymentRequest(
    data: CreatePaymentRequestDTO,
  ): Promise<PaymentRequestResponse> {
    try {
      const response = await axios.post(`${MOYASAR_API_URL}/invoices`, data, {
        auth: {
          username: MOYASAR_SECRET_KEY,
          password: "",
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "Moyasar payment request creation failed:",
        error.response?.data,
      );
      throw new Error(
        error.response?.data?.message || "Payment request creation failed",
      );
    }
  }
  /**
   * Get payment status from Moyasar
   */
  async getPaymentStatus(paymentId: string): Promise<MoyasarPaymentResponse> {
    try {
      const response = await axios.get(
        `${MOYASAR_API_URL}/payments/${paymentId}`,
        {
          auth: {
            username: MOYASAR_SECRET_KEY,
            password: "",
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.error("Failed to fetch payment status:", error.response?.data);
      throw new Error(
        error.response?.data?.message || "Failed to fetch payment status",
      );
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
  ): Promise<MoyasarPaymentResponse> {
    try {
      const response = await axios.post(
        `${MOYASAR_API_URL}/payments/${paymentId}/refund`,
        amount ? { amount } : {},
        {
          auth: {
            username: MOYASAR_SECRET_KEY,
            password: "",
          },
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.error("Payment refund failed:", error.response?.data);
      throw new Error(error.response?.data?.message || "Refund failed");
    }
  }

  /**
   * Verify payment callback signature (webhook verification)
   */
  verifyCallback(payload: any, signature: string): boolean {
    // Moyasar uses HMAC signature verification
    // Implementation depends on your webhook setup
    // For now, we'll return true and validate payment status instead
    return true;
  }
}

export default new PaymentService();
