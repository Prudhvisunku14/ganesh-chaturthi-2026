const { buildMessage } = require("./message");

// Formats an Indian phone number for wa.me.
// Accepts:  9876543210 (10 digits)
//           09876543210 (0-prefixed, 11 digits)
//           919876543210 (already +91, 12 digits)
function formatIndianPhone(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits; // fall back as-is
}

// Builds the wa.me click-to-chat URL.
// encodeURIComponent handles all Unicode/emoji characters correctly.
function buildWhatsAppLink(participant) {
  const phone = formatIndianPhone(participant.phone);
  const message = buildMessage(participant);
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}

module.exports = { formatIndianPhone, buildMessage, buildWhatsAppLink };

