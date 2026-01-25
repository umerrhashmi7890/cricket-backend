import nodemailer from "nodemailer";
import {
  EmailOptions,
  BookingConfirmationEmailData,
  BookingCancellationEmailData,
  PaymentReceiptEmailData,
} from "../types/email.types";

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "465"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  private static get fromEmail() {
    return process.env.SMTP_FROM;
  }

  private static get fromName() {
    return process.env.SMTP_FROM_NAME || "Jeddah Nets Cricket";
  }

  /**
   * Send a generic email
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  /**
   * Send booking confirmation email
   */
  static async sendBookingConfirmation(
    data: BookingConfirmationEmailData,
  ): Promise<boolean> {
    if (!data.customerEmail) {
      console.log("No email provided, skipping confirmation email");
      return false;
    }

    const subject = `Booking Confirmed - ${data.bookingId}`;
    const html = this.getBookingConfirmationTemplate(data);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  /**
   * Send booking cancellation email
   */
  static async sendBookingCancellation(
    data: BookingCancellationEmailData,
    customerEmail: string,
  ): Promise<boolean> {
    if (!customerEmail) {
      console.log("No email provided, skipping cancellation email");
      return false;
    }

    const subject = `Booking Cancelled - ${data.bookingId}`;
    const html = this.getCancellationTemplate(data);

    return this.sendEmail({
      to: customerEmail,
      subject,
      html,
    });
  }

  /**
   * Send payment receipt email
   */
  static async sendPaymentReceipt(
    data: PaymentReceiptEmailData,
  ): Promise<boolean> {
    if (!data.customerEmail) {
      console.log("No email provided, skipping payment receipt");
      return false;
    }

    const subject = `Payment Receipt - ${data.bookingId}`;
    const html = this.getPaymentReceiptTemplate(data);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  /**
   * Booking confirmation email template
   */
  private static getBookingConfirmationTemplate(
    data: BookingConfirmationEmailData,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px 20px;
    }
    .booking-details {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      color: #333;
      text-align: right;
    }
    .price-total {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid {
      background: #d4edda;
      color: #155724;
    }
    .status-partial {
      background: #fff3cd;
      color: #856404;
    }
    .status-pending {
      background: #f8d7da;
      color: #721c24;
    }
    .footer {
      background: #f9f9f9;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    @media only screen and (max-width: 600px) {
      .detail-row {
        flex-direction: column;
      }
      .detail-value {
        text-align: left;
        margin-top: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏏 Booking Confirmed!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Thank you for choosing Jeddah Nets Cricket</p>
    </div>
    
    <div class="content">
      <p>Dear <strong>${data.customerName}</strong>,</p>
      
      <p>Your cricket court booking has been confirmed! We're excited to have you play at our facility.</p>
      
      <div class="booking-details">
        <h2 style="margin-top: 0; color: #667eea;">Booking Details</h2>
        
        <div class="detail-row">
          <span class="detail-label">Booking ID</span>
          <span class="detail-value"><strong>${data.bookingId}</strong></span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Court</span>
          <span class="detail-value">${data.courtName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${data.bookingDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${data.startTime} - ${data.endTime}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Duration</span>
          <span class="detail-value">${data.durationHours} hour(s)</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Total Price</span>
          <span class="detail-value price-total">${data.totalPrice} SAR</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Amount Paid</span>
          <span class="detail-value"><strong>${data.amountPaid} SAR</strong></span>
        </div>
        
        ${
          data.paymentStatus === "partial"
            ? `
        <div class="detail-row">
          <span class="detail-label">Remaining Balance</span>
          <span class="detail-value" style="color: #e74c3c;"><strong>${data.totalPrice - data.amountPaid} SAR</strong></span>
        </div>
        `
            : ""
        }
        
        <div class="detail-row">
          <span class="detail-label">Payment Status</span>
          <span class="detail-value">
            <span class="status-badge status-${data.paymentStatus}">
              ${data.paymentStatus}
            </span>
          </span>
        </div>
        
        ${
          data.paymentMethod
            ? `
        <div class="detail-row">
          <span class="detail-label">Payment Method</span>
          <span class="detail-value">${data.paymentMethod}</span>
        </div>
        `
            : ""
        }
      </div>
      
      ${
        data.paymentStatus === "partial"
          ? `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ Payment Reminder:</strong><br>
        You have paid ${data.amountPaid} SAR online. Please bring <strong>${data.totalPrice - data.amountPaid} SAR</strong> cash or card to complete payment at the venue.
      </div>
      `
          : ""
      }
      
      <div style="background: #e8f4f8; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>📋 Important Information:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Please arrive 10 minutes before your booking time</li>
          <li>Bring your booking ID: <strong>${data.bookingId}</strong></li>
          <li>Contact us: ${data.customerPhone}</li>
          <li>Cancellations must be made 24 hours in advance for refund</li>
        </ul>
      </div>
      
      <p>If you have any questions or need to modify your booking, please contact us.</p>
      
      <p style="margin-top: 30px;">
        See you soon!<br>
        <strong>Jeddah Nets Cricket Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>Jeddah Nets Cricket | Premium Cricket Facilities</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Booking cancellation email template
   */
  private static getCancellationTemplate(
    data: BookingCancellationEmailData,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Cancelled</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: #e74c3c;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px 20px;
    }
    .booking-details {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
      display: block;
      margin-bottom: 5px;
    }
    .footer {
      background: #f9f9f9;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Cancelled</h1>
    </div>
    
    <div class="content">
      <p>Dear <strong>${data.customerName}</strong>,</p>
      
      <p>Your booking has been cancelled as requested.</p>
      
      <div class="booking-details">
        <h2 style="margin-top: 0; color: #e74c3c;">Cancelled Booking Details</h2>
        
        <div class="detail-row">
          <span class="detail-label">Booking ID</span>
          <span>${data.bookingId}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Court</span>
          <span>${data.courtName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span>${data.bookingDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span>${data.startTime} - ${data.endTime}</span>
        </div>
        
        ${
          data.refundAmount
            ? `
        <div class="detail-row">
          <span class="detail-label">Refund Amount</span>
          <span><strong>${data.refundAmount} SAR</strong></span>
        </div>
        `
            : ""
        }
        
        ${
          data.cancellationReason
            ? `
        <div class="detail-row">
          <span class="detail-label">Reason</span>
          <span>${data.cancellationReason}</span>
        </div>
        `
            : ""
        }
      </div>
      
      ${
        data.refundAmount
          ? `
      <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>✅ Refund Processed:</strong><br>
        A refund of <strong>${data.refundAmount} SAR</strong> will be credited to your original payment method within 5-7 business days.
      </div>
      `
          : ""
      }
      
      <p>We're sorry to see you go. We hope to serve you again in the future!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Jeddah Nets Cricket Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>Jeddah Nets Cricket | Premium Cricket Facilities</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Payment receipt email template
   */
  private static getPaymentReceiptTemplate(
    data: PaymentReceiptEmailData,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: #28a745;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px 20px;
    }
    .receipt-details {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #28a745;
    }
    .footer {
      background: #f9f9f9;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Payment Receipt</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Thank you for your payment</p>
    </div>
    
    <div class="content">
      <p>Dear <strong>${data.customerName}</strong>,</p>
      
      <p>We have received your payment. Here's your receipt:</p>
      
      <div class="receipt-details">
        <h2 style="margin-top: 0; color: #28a745;">Payment Details</h2>
        
        <div class="detail-row">
          <span class="detail-label">Booking ID</span>
          <span class="detail-value"><strong>${data.bookingId}</strong></span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Payment Date</span>
          <span class="detail-value">${data.paymentDate}</span>
        </div>
        
        ${
          data.paymentReference
            ? `
        <div class="detail-row">
          <span class="detail-label">Transaction Reference</span>
          <span class="detail-value">${data.paymentReference}</span>
        </div>
        `
            : ""
        }
        
        <div class="detail-row">
          <span class="detail-label">Payment Method</span>
          <span class="detail-value">${data.paymentMethod || "Online Payment"}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Amount Paid</span>
          <span class="detail-value total-amount">${data.amountPaid} SAR</span>
        </div>
      </div>
      
      <div class="receipt-details">
        <h2 style="margin-top: 0; color: #667eea;">Booking Information</h2>
        
        <div class="detail-row">
          <span class="detail-label">Court</span>
          <span class="detail-value">${data.courtName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${data.bookingDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time</span>
          <span class="detail-value">${data.startTime} - ${data.endTime}</span>
        </div>
      </div>
      
      <p>Keep this receipt for your records. If you have any questions about this payment, please contact us.</p>
      
      <p style="margin-top: 30px;">
        Thank you for your business!<br>
        <strong>Jeddah Nets Cricket Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>Jeddah Nets Cricket | Premium Cricket Facilities</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Test email configuration
   */
  static async testConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log("✅ Email service is ready");
      return true;
    } catch (error) {
      console.error("❌ Email service error:", error);
      return false;
    }
  }
}
