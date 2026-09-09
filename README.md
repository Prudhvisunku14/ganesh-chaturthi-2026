# Ganesh Chaturthi 2026 — Registration, Payment & Food QR System

A single-event registration, payment verification, one-time food QR, and
volunteer scanner system, built for ~300 attendees. Next.js 15 (App Router),
Supabase PostgreSQL for persistent storage on Vercel Hobby,
QR generation, WhatsApp click-to-chat (no paid API), and an atomic one-time
QR claim so the same code can never be used twice, even under concurrent
scans at the food counter.

---

## 1. Setup and deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the free Vercel + Supabase setup,
existing SQLite data migration, environment variables, and event checks.

Requires Node 22.13+. Configure `.env.local`, then run:

```bash
npm ci
npm run db:setup
# Optional: npm run db:migrate-sqlite (before seed, for existing local data)
npm run seed
npm run dev
```

The seed command uses your ADMIN_PASSWORD and VOLUNTEER_PASSWORD; it does
not add demo participants. SQLite is only read by the migration script.

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
same QR at the same instant can never both get "valid". Local PostgreSQL tests exercise 20 competing claims with exactly one success.
Repeat the simultaneous two-phone test against the deployed Supabase database.

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

## 4. Database

The app uses Supabase PostgreSQL through its transaction pooler. All SQL
queries are asynchronous and parameterized. Application data and the invitation
poster live in the private `app` schema. See `supabase/schema.sql`.

## 5. Deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Vercel functions are configured for
Mumbai. Posters persist in PostgreSQL and are limited to 3 MB.

---

## 6. What's deliberately NOT built (scope discipline, per the brief)

- No Kafka/Redis/microservices/Kubernetes — single Next.js app, single PostgreSQL database.
- No paid WhatsApp API — click-to-chat links only; the organizer presses
  Send manually every time. (Direct automated email sending via SMTP is supported).
- Google Sheets Sync — handled via zero-cost installable Apps Script trigger posting to `/api/participants/webhook`.
- No password-reset/user-management UI — two seeded logins is enough for a
  single event with a small organizing team; rotate the demo passwords
  with `ADMIN_PASSWORD`, `VOLUNTEER_PASSWORD`, and `npm run seed` before the event.

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
  db.js         PostgreSQL connection and parameterized query helpers
  auth.js       JWT session helpers, role guard
  message.js    Shared personalized message generator
  qr.js         secure token generation + QR image rendering (data URL & PNG buffer)
  email.js      Nodemailer SMTP email delivery with attached QR PNG
  whatsapp.js   phone formatting + wa.me click-to-chat links
scripts/seed.js  create/rotate admin and volunteer passwords
middleware.js    route-level redirect for auth/role (UX only — real
                 authorization is enforced again in every API route)
```

---

## 8. Event verification checklist (repeat on the deployed site)

- [ ] Login as admin / volunteer, correct role-based redirect and access
- [ ] Volunteer blocked from admin-only API routes (401)
- [ ] Auto-sync webhook (`POST /api/participants/webhook`): authenticates shared secret, inserts pending row, skips duplicate phone
- [ ] CSV import: valid rows inserted matching real form headers (`Timestamp`, `Email Address`, `Mobile Number`, `Programme`, `Payment Proof`), duplicate phone skipped
- [ ] Verify payment → QR token generated (cryptographically random, not
      derived from name/phone/ID)
- [ ] Reject payment → no usable QR
- [ ] WhatsApp link: correct `wa.me` phone formatting, correct personalized
      message, correctly URL-encoded
- [ ] Email delivery (`POST /api/participants/[id]/email`): sends email via SMTP with attached QR PNG buffer and shared personalized text message, updates `email_sent` timestamp
- [ ] First scan of a valid QR → `valid`, food marked claimed
- [ ] Second scan of the same QR → `already_used`
- [ ] Unrecognized token → `invalid_unrecognized`
- [ ] 20 concurrent scans of one fresh token → exactly 1 `valid`, rest
      `already_used`/rate-limited
- [ ] CSV export includes all required columns including `email` and `email_status`
- [ ] Dashboard stats and food-collection progress update after scans

