// lib/email.js
const nodemailer = require("nodemailer");
const { buildMessage } = require("./message");
const { generateQrPngBuffer } = require("./qr");

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP credentials (SMTP_USER and SMTP_PASS) are not configured in environment variables.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true only for 465 (SSL), false for 587 (TLS/STARTTLS)
    auth: { user, pass },
  });
}

async function sendQrEmail(participant) {
  if (!participant || !participant.email) {
    throw new Error("Participant has no email address.");
  }
  if (!participant.qr_token) {
    throw new Error("Participant has no QR token.");
  }

  const qrBuffer = await generateQrPngBuffer(participant.qr_token);
  const textMessage = buildMessage(participant);
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "Ganesh Chaturthi 2026 Committee";

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      ${textMessage.split("\n").map(line => `<p style="margin: 0 0 10px 0;">${line}</p>`).join("")}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="font-size: 13px; color: #666;">Note: Your food QR code is attached to this email as a PNG file. Please keep it handy on your phone for scanning at the counter.</p>
    </div>
  `;

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from,
    to: participant.email,
    subject: "Your Ganesh Chaturthi 2026 Food QR Code",
    text: textMessage,
    html: htmlMessage,
    attachments: [
      {
        filename: `food-qr-${participant.registration_id || "code"}.png`,
        content: qrBuffer,
        contentType: "image/png",
      },
    ],
  });

  return info;
}

module.exports = { sendQrEmail };
