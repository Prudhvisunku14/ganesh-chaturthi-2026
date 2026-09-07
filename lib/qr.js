// lib/qr.js
const { randomBytes } = require("crypto");
const QRCode = require("qrcode");

// Cryptographically secure, unguessable token. Not derived from name/phone/id.
function generateSecureToken() {
  return randomBytes(24).toString("base64url"); // 32 chars, URL-safe
}

function getQrPayload(token) {
  const base = process.env.APP_BASE_URL || "";
  return base ? `${base}/verify/${token}` : token;
}

// The QR image encodes only this token (or a verification URL wrapping it —
// see APP_BASE_URL below). No personal data is embedded in the QR itself.
async function generateQrDataUrl(token) {
  const payload = getQrPayload(token);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
  });
}

// Returns a PNG buffer of the QR code for email attachments.
async function generateQrPngBuffer(token) {
  const payload = getQrPayload(token);
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
    type: "png",
  });
}

module.exports = { generateSecureToken, generateQrDataUrl, generateQrPngBuffer };

