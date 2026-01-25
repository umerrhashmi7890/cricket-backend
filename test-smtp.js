const nodemailer = require("nodemailer");

// Hardcoded credentials for testing
const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true, // SSL
  auth: {
    user: "contact@jeddahcricketnets.com",
    pass: "Welcome223070!",
  },
  debug: true, // Show debug output
  logger: true, // Log to console
});

console.log("Testing SMTP connection to Titan...\n");

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ SMTP Connection Failed:");
    console.log(error);
    console.log("\n🔍 This likely means:");
    console.log("  - Third-party access is disabled in Titan");
    console.log("  - Password is incorrect");
    console.log("  - SMTP access needs to be enabled");
  } else {
    console.log("✅ SMTP Connection Successful!");
    console.log("Server is ready to send emails");
    console.log("\n🔍 The issue is NOT with third-party access");
  }
});
