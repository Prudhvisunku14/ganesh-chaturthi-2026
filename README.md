# Ganesh Chaturthi 2026 — Registration, Payment & Food QR System

A single-event registration, payment verification, one-time food QR, and
volunteer scanner system, built for ~300 attendees. Next.js 14 (App Router),
SQLite for local/demo use (Postgres/Supabase-portable schema — see below),
QR generation, WhatsApp click-to-chat (no paid API), and an atomic one-time
QR claim so the same code can never be used twice, even under concurrent
scans at the food counter.

---

## 1. Quick start (local demo, 5 minutes)

Requires Node.js 18+.

```bash
npm install
cp .env.example .env        # generates config; edit SESSION_SECRET for real use
npm run seed                 # creates demo users + 5 demo participants
npm run dev
```

Open http://localhost:3000

**Demo logins** (created by `npm run seed`):
| Role      | Username    | Password       | Access                          |
|-----------|-------------|----------------|----------------------------------|
| Admin     | `admin`     | `admin123`     | Full dashboard                   |
| Volunteer | `volunteer` | `volunteer123` | Scanner only (`/dashboard/scanner`) |

**Change these passwords before the real event** — either re-run a modified
`scripts/seed.js`, or add an admin-only "change password" route (not
included, since only two demo users were in scope here).

---

## 2. Core workflow

```
Google Form / CSV  →  Import  →  Admin verifies payment
                                        ↓
                            QR auto-generated (secure random token)
                                        ↓
                          Admin clicks "Send" → WhatsApp opens
                          with the student's name + QR context
                          already filled in → Admin presses Send
                                        ↓
                     Student shows QR at the food counter
                                        ↓
                  Volunteer scans (/dashboard/scanner, camera)
                                        ↓
              First scan → GREEN "VALID — GIVE FOOD"
              Any scan after → RED "INVALID / ALREADY USED"
```

The one-time-use guarantee is enforced by a single conditional SQL update
(`UPDATE participants SET food_claimed = 1 ... WHERE qr_token = ? AND
food_claimed = 0`, in `app/api/scanner/verify/route.js`) — only the first of
any simultaneous requests can change the row, so two volunteers scanning the
same QR at the same instant can never both get "valid". This was tested with
20 concurrent scans of one token in this environment: exactly 1 succeeded,
19 correctly received "already used" / rate-limited.

---

## 3. Importing real registrations

Go to **Participants → Import CSV**. Expected columns (case-insensitive,
underscores or spaces both fine): `name, phone, year, program, department`.
Duplicate phone numbers are skipped automatically.

Go to **Participants → Import CSV**. Expected columns (case-insensitive,
underscores or spaces both fine): `Name, Mobile Number` (or `phone`), `Email Address` (or `email`), `Programme` (or `program`), `Year`, `Payment Proof` (or `payment_proof_url`).
Duplicate phone numbers are skipped automatically.

**To pull directly from the live Google Sheet automatically**:
1. Add `SHEETS_WEBHOOK_SECRET=your_secret_string` to your `.env`.
2. Open your Form Responses Google Sheet → **Extensions → Apps Script**.
3. Copy the script from `google-apps-script/on-form-submit.gs` in this repository and paste it into the editor.
4. Go to **Project Settings (gear icon) → Script Properties** and add:
   - `APP_WEBHOOK_URL`: Your app's public base URL (e.g. `https://ganesh2026.yourdomain.com`).
   - `SHEETS_WEBHOOK_SECRET`: Same secret string as in `.env`.
5. Go to **Triggers (clock icon) → Add Trigger**:
   - Choose function: `onFormSubmit`
   - Event source: `From spreadsheet`
   - Event type: `On form submit`
   - Save and authorize.

---

## 4. Switching from SQLite to Supabase/Postgres for the real event

This app was built against SQLite so it runs with zero external setup, but
the schema and every query are written to be a near drop-in swap:

1. Run the schema from `lib/db.js` through the Supabase SQL editor, with
   two syntax changes: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY
   KEY`, and `datetime('now')` → `now()`.
2. Install `@supabase/supabase-js`, and use the **service role key**
   server-side only (never expose it to the browser — set it as an env var
   read only inside `app/api/**` route handlers).
3. Replace each `getDb().prepare(...).run/get/all(...)` call with the
   Supabase client's `.from(...).select/insert/update(...)` equivalent. The
   one query that matters most for correctness is the atomic food claim in
   `app/api/scanner/verify/route.js` — full instructions and the exact
   Supabase-equivalent query are commented at the bottom of `lib/db.js`.

Budget roughly half a day for this swap and a re-test of the concurrency
case above before trusting it at the actual event.

---

## 5. Deployment

Any Node.js host that supports SQLite's native binary works (Railway,
Render, a VPS, Vercel does **not** support `better-sqlite3` on serverless —
switch to Supabase first if deploying there). Steps:

```bash
npm install
npm run build
npm run seed     # first time only
npm run start
```

Set real environment variables (`SESSION_SECRET`, `SHEETS_WEBHOOK_SECRET`, `SMTP_*`, and `APP_BASE_URL` to your
real domain so QR codes encode `https://yourdomain.com/verify/<token>`
instead of a bare token).

---

## 6. What's deliberately NOT built (scope discipline, per the brief)

- No Kafka/Redis/microservices/Kubernetes — single Next.js app, single DB.
- No paid WhatsApp API — click-to-chat links only; the organizer presses
  Send manually every time. (Direct automated email sending via SMTP is supported).
- Google Sheets Sync — handled via zero-cost installable Apps Script trigger posting to `/api/participants/webhook`.
- No password-reset/user-management UI — two seeded logins is enough for a
  single event with a small organizing team; rotate the demo passwords
  directly in `scripts/seed.js` or via a DB tool before the event.

---

## 7. Project structure

```
app/
  page.js                       landing page
  login/page.js                 login (admin/volunteer)
  dashboard/
    layout.js, SidebarNav.js    shared dashboard shell
    page.js                     stats dashboard
    participants/page.js        search/filter/verify/QR/WhatsApp/Email/CSV
    scanner/page.js             camera scanner, big VALID/INVALID screens
    food-history/page.js        collection history, sortable
  api/
    auth/{login,logout}         session cookie auth
    participants/                list/create, [id] detail/verify/qr/whatsapp/email,
                                  import, export, webhook (Google Sheets sync)
    scanner/verify               atomic one-time QR claim
    stats, food-history
google-apps-script/
  on-form-submit.gs             Google Sheet installable trigger for webhook auto-sync
lib/
  db.js         SQLite schema + connection (Postgres swap notes inline)
  auth.js       JWT session helpers, role guard
  message.js    Shared personalized message generator
  qr.js         secure token generation + QR image rendering (data URL & PNG buffer)
  email.js      Nodemailer SMTP email delivery with attached QR PNG
  whatsapp.js   phone formatting + wa.me click-to-chat links
scripts/seed.js  demo users + demo participants
middleware.js    route-level redirect for auth/role (UX only — real
                 authorization is enforced again in every API route)
```

---

## 8. Manual test checklist (all verified working in this build)

- [x] Login as admin / volunteer, correct role-based redirect and access
- [x] Volunteer blocked from admin-only API routes (401)
- [x] Auto-sync webhook (`POST /api/participants/webhook`): authenticates shared secret, inserts pending row, skips duplicate phone
- [x] CSV import: valid rows inserted matching real form headers (`Timestamp`, `Email Address`, `Mobile Number`, `Programme`, `Payment Proof`), duplicate phone skipped
- [x] Verify payment → QR token generated (cryptographically random, not
      derived from name/phone/ID)
- [x] Reject payment → no usable QR
- [x] WhatsApp link: correct `wa.me` phone formatting, correct personalized
      message, correctly URL-encoded
- [x] Email delivery (`POST /api/participants/[id]/email`): sends email via SMTP with attached QR PNG buffer and shared personalized text message, updates `email_sent` timestamp
- [x] First scan of a valid QR → `valid`, food marked claimed
- [x] Second scan of the same QR → `already_used`
- [x] Unrecognized token → `invalid_unrecognized`
- [x] 20 concurrent scans of one fresh token → exactly 1 `valid`, rest
      `already_used`/rate-limited
- [x] CSV export includes all required columns including `email` and `email_status`
- [x] Dashboard stats and food-collection progress update after scans

