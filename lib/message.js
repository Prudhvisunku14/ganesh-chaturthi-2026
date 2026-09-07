// lib/message.js
// Encoding note: UTF-8 (no BOM).
// Builds the personalized message text for a verified participant.
// NAME comes directly from the database row — never hard-coded.

function buildMessage(participant) {
  const name = participant.name || "Student";
  return (
    "\uD83D\uDE4F Jai Shri Ganesh \uD83D\uDE4F\n" +
    "\n" +
    "Hi " + name + ",\n" +
    "\n" +
    "We are happy to inform you that we have received your payment of \u20B9300 for Ganesh Chaturthi 2026.\n" +
    "\n" +
    "With the blessings of Lord Ganesha, you are warmly invited to join us for:\n" +
    "\n" +
    "\uD83E\uDE94 Ganesh Pooja\n" +
    "\uD83C\uDFAD Cultural Program\n" +
    "\uD83C\uDF5B South Indian Dinner\n" +
    "\n" +
    "\uD83D\uDCCD Venue: Auditorium\n" +
    "\uD83D\uDCC5 Date: 14th September 2026\n" +
    "\n" +
    "\uD83C\uDF7D\uFE0F FOOD QR CODE\n" +
    "\n" +
    "Please keep the attached QR code safely and present it at the food counter to collect your dinner.\n" +
    "\n" +
    "\u26A0\uFE0F IMPORTANT:\n" +
    "This QR code is unique to you and can be used only once for food collection. Please do not share it with anyone else.\n" +
    "\n" +
    "We look forward to celebrating Ganesh Chaturthi together with devotion, joy and togetherness. \uD83D\uDE4F\n" +
    "\n" +
    "Ganpati Bappa Morya! \uD83E\uDE94\uD83D\uDE4F"
  );
}

module.exports = { buildMessage };
