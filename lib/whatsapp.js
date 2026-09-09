const { readPoster } = require("./poster");
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
function buildWhatsAppLink(participant, template) {
  const phone = formatIndianPhone(participant.phone);
  const message = buildMessage(participant, template);
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}

function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function sendWhatsAppCloud(participant, message, posterPath, qrBuffer) {
  if (!isWhatsAppConfigured()) throw new Error("WhatsApp Cloud API is not configured.");
  const base = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
  const headers = { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` };
  const phone = formatIndianPhone(participant.phone);

  async function sendJson(body) {
    const response = await fetch(`${base}/messages`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${await response.text()}`);
  }

  async function uploadMedia(buffer, contentType, filename) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([buffer], { type: contentType }), filename);
    const response = await fetch(`${base}/media`, { method: "POST", headers, body: form });
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error(`WhatsApp media upload failed: ${JSON.stringify(data)}`);
    return data.id;
  }

  await sendJson({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } });
  if (posterPath) {
    const poster = await readPoster(posterPath);
    const posterId = await uploadMedia(poster.content, poster.contentType, posterPath.split(/[\\/]/).pop());
    await sendJson({ messaging_product: "whatsapp", to: phone, type: "image", image: { id: posterId, caption: "Invitation poster" } });
  }
  const qrId = await uploadMedia(qrBuffer, "image/png", `food-qr-${participant.id}.png`);
  await sendJson({ messaging_product: "whatsapp", to: phone, type: "image", image: { id: qrId, caption: "Your unique food QR code" } });
}

module.exports = { formatIndianPhone, buildMessage, buildWhatsAppLink, isWhatsAppConfigured, sendWhatsAppCloud };
