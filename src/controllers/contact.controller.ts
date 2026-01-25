import { Request, Response } from "express";
import { EmailService } from "../services/email.service";
import { ContactForm } from "../types/contact.types";

export const handleContactForm = async (req: Request, res: Response) => {
  try {
    const payload: ContactForm = req.body;

    // Basic validation
    if (
      !payload ||
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.subject ||
      !payload.message
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // Prepare email content to send to site inbox
    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${payload.firstName} ${payload.lastName}</p>
      <p><strong>Email:</strong> ${payload.email}</p>
      <p><strong>Phone:</strong> ${payload.phone || "-"}</p>
      <p><strong>Subject:</strong> ${payload.subject}</p>
      <h3>Message:</h3>
      <p>${payload.message.replace(/\n/g, "<br>")}</p>
      <hr />
      <p>Received: ${new Date().toISOString()}</p>
    `;

    const to = process.env.SMTP_FROM || "contact@jeddahcricketnets.com";

    const sent = await EmailService.sendEmail({
      to,
      subject: `Contact Form: ${payload.subject}`,
      html,
      // set reply-to so admin can reply directly to user
      text: `Name: ${payload.firstName} ${payload.lastName}\nEmail: ${payload.email}\nPhone: ${payload.phone || "-"}\n\nMessage:\n${payload.message}`,
    });

    if (sent) {
      // Optionally send auto-reply to user (uncomment if desired)
      // await EmailService.sendEmail({
      //   to: payload.email,
      //   subject: "We received your message",
      //   html: `<p>Hi ${payload.firstName},</p><p>Thanks for contacting Jeddah Nets Cricket. We'll get back to you shortly.</p>`,
      // });

      return res.json({
        success: true,
        message: "Message sent to contact inbox",
      });
    }

    return res
      .status(500)
      .json({ success: false, error: "Failed to send message" });
  } catch (error) {
    console.error("Contact form error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};
