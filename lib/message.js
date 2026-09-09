// lib/message.js
// Encoding note: UTF-8 (no BOM).

function renderTemplate(template, participant) {
  const values = {
    NAME: participant.name || "",
    PROGRAM: participant.program || "",
    YEAR: participant.year || "",
    DATE: process.env.EVENT_DATE || "14th September 2026",
    VENUE: process.env.EVENT_VENUE || "Auditorium",
  };
  return String(template || "").replace(/\{(NAME|PROGRAM|YEAR|DATE|VENUE)\}/g, (_, key) => values[key]);
}

function buildMessage(participant, template) {
  return renderTemplate(template || "Hi {NAME}", participant);
}

module.exports = { buildMessage, renderTemplate };
