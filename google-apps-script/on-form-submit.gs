/**
 * Ganesh Chaturthi 2026 — Google Apps Script
 *
 * ONE-WAY SYNC: Google Form → App
 *
 * TWO functions:
 *   1. onFormSubmit()         — Auto-fires for every NEW form submission.
 *   2. syncAllPastResponses() — Run ONCE manually to push all existing
 *                               sheet rows (past submissions) to the app.
 *
 * Script Properties (Extensions → Apps Script → Project Settings):
 *   APP_WEBHOOK_URL        = https://ganesh2026.serveo.net   ← UPDATE THIS
 *   SHEETS_WEBHOOK_SECRET  = ganesh2026-webhook-secret-key-12345
 *
 * Column structure in linked Google Sheet (Form Responses 1):
 *   A: Timestamp | B: Email Address | C: Name | D: Mobile Number |
 *   E: Programme | F: Year | G: Payment Proof
 */

// ─── Utility: extract a field from namedValues with fuzzy key matching ────────
function extractField(namedValues, possibleNames) {
  if (!namedValues) return "";
  for (var key in namedValues) {
    var cleanKey = key.trim().replace(/\s*\*+$/, "").trim().toLowerCase();
    for (var i = 0; i < possibleNames.length; i++) {
      var target = possibleNames[i].trim().toLowerCase();
      if (cleanKey === target || cleanKey.indexOf(target) === 0) {
        var val = namedValues[key];
        return (val && val.length > 0) ? String(val[0]).trim() : "";
      }
    }
  }
  return "";
}

// ─── Send one row payload to the webhook ─────────────────────────────────────
function sendToWebhook(endpoint, secret, payload) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var code = response.getResponseCode();
    var body = response.getContentText();
    Logger.log("→ " + code + " | " + body);
    return code;
  } catch (err) {
    Logger.log("ERROR: " + err.toString());
    return 0;
  }
}

// ─── 1. TRIGGER: fires automatically on every new form submission ─────────────
function onFormSubmit(e) {
  var props    = PropertiesService.getScriptProperties();
  var appUrl   = props.getProperty("APP_WEBHOOK_URL");
  var secret   = props.getProperty("SHEETS_WEBHOOK_SECRET");

  if (!appUrl || !secret) {
    Logger.log("ERROR: APP_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET is missing.");
    return;
  }

  var endpoint = appUrl.replace(/\/+$/, "") + "/api/participants/webhook";

  var timestamp = "", email = "", name = "", phone = "", programme = "", year = "", paymentProofUrl = "";

  if (e && e.namedValues) {
    timestamp       = extractField(e.namedValues, ["Timestamp"]);
    email           = extractField(e.namedValues, ["Email Address", "Email", "Email ID"]);
    name            = extractField(e.namedValues, ["Name", "Full Name", "Participant Name"]);
    phone           = extractField(e.namedValues, ["Mobile Number", "Phone Number", "Mobile", "Phone", "Contact Number"]);
    programme       = extractField(e.namedValues, ["Programme", "Program", "Course", "Branch"]);
    year            = extractField(e.namedValues, ["Year", "Year of Study"]);
    paymentProofUrl = extractField(e.namedValues, ["Payment Proof", "Payment Proof Upload", "Payment Screenshot", "Payment Receipt"]);
  }

  // Fallback to indexed values
  if (e && e.values) {
    if (!timestamp       && e.values[0]) timestamp       = e.values[0];
    if (!email           && e.values[1]) email           = e.values[1];
    if (!name            && e.values[2]) name            = e.values[2];
    if (!phone           && e.values[3]) phone           = e.values[3];
    if (!programme       && e.values[4]) programme       = e.values[4];
    if (!year            && e.values[5]) year            = e.values[5];
    if (!paymentProofUrl && e.values[6]) paymentProofUrl = e.values[6];
  }

  sendToWebhook(endpoint, secret, {
    secret: secret, timestamp: timestamp, email: email,
    name: name, phone: phone, programme: programme,
    year: year, payment_proof_url: paymentProofUrl
  });
}

// ─── 2. MANUAL: run once to push ALL past sheet rows to the app ───────────────
/**
 * HOW TO RUN:
 *   1. Open Apps Script editor
 *   2. Select function "syncAllPastResponses" from the dropdown
 *   3. Click ▶ Run
 *   4. Check Execution log — it will show each row's result
 *
 * Duplicate phone numbers are automatically skipped by the webhook (safe to re-run).
 */
function syncAllPastResponses() {
  var props    = PropertiesService.getScriptProperties();
  var appUrl   = props.getProperty("APP_WEBHOOK_URL");
  var secret   = props.getProperty("SHEETS_WEBHOOK_SECRET");

  if (!appUrl || !secret) {
    Logger.log("ERROR: APP_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET is missing.");
    return;
  }

  var endpoint = appUrl.replace(/\/+$/, "") + "/api/participants/webhook";

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheets()[0]; // Form Responses 1
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    Logger.log("No data rows found in sheet.");
    return;
  }

  // Read all data rows at once (columns A–G = indices 1–7)
  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  var sent = 0, skipped = 0, failed = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    var timestamp       = String(row[0] || "").trim();
    var email           = String(row[1] || "").trim();
    var name            = String(row[2] || "").trim();
    var phone           = String(row[3] || "").trim();
    var programme       = String(row[4] || "").trim();
    var year            = String(row[5] || "").trim();
    var paymentProofUrl = String(row[6] || "").trim();

    // Skip completely empty rows
    if (!name && !phone) {
      Logger.log("Row " + (i + 2) + ": SKIPPED (empty name + phone)");
      skipped++;
      continue;
    }

    Logger.log("Row " + (i + 2) + ": Sending — " + name + " / " + phone);

    var code = sendToWebhook(endpoint, secret, {
      secret: secret, timestamp: timestamp, email: email,
      name: name, phone: phone, programme: programme,
      year: year, payment_proof_url: paymentProofUrl
    });

    if (code === 200 || code === 201) {
      sent++;
    } else if (code === 0) {
      failed++;
    } else {
      // 401 = wrong secret, 400 = missing fields, 200 skipped = duplicate
      skipped++;
    }

    // Small delay to avoid overwhelming the server
    if (i < data.length - 1) Utilities.sleep(300);
  }

  Logger.log("─────────────────────────────────");
  Logger.log("✅ Done! Sent: " + sent + " | Skipped/Duplicate: " + skipped + " | Failed: " + failed);
  Logger.log("Total rows processed: " + data.length);
}
