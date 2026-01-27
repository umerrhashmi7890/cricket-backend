const nodemailer = require("nodemailer");

// Email configuration
const sendEmail = async () => {
  try {
    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      auth: {
        user: "contact@jeddahcricketnets.com",
        pass: "Welcome223070!",
      },
    });

    // Email options
    const mailOptions = {
      from: '"Jeddah Nets Cricket" <contact@jeddahcricketnets.com>',
      to: "yaseenjabir791@gmail.com",
      subject: "Test Email from Jeddah Nets Cricket Backend",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #2563eb;">Test Email</h2>
          <p>This is a test email from the Jeddah Nets Cricket booking system backend.</p>
          <p>If you're receiving this, the email configuration is working correctly!</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            Sent at: ${new Date().toLocaleString()}
          </p>
        </div>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    console.error("Full error:", error);
  }
};

// Run the function
sendEmail();
