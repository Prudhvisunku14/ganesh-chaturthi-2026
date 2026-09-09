# Free deployment: Vercel Hobby + Supabase Free

Use a Supabase Free project in Mumbai and a personal Vercel Hobby project.
`vercel.json` selects Mumbai (`bom1`) for the application functions. No paid
integration, disk, or database add-on is required. Free services have usage
limits; this is not a guarantee of uptime or scan latency. Check Supabase is
active before the event, because free projects can pause after inactivity.

## 1. Configure the database

In Supabase, open **Connect**, choose **Transaction pooler** (port **6543**),
and copy the connection URI. Put it in `.env.local` in this app directory:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres
SESSION_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
ADMIN_PASSWORD=YOUR_DISTINCT_ADMIN_PASSWORD_AT_LEAST_8_CHARACTERS
VOLUNTEER_PASSWORD=YOUR_DISTINCT_VOLUNTEER_PASSWORD_AT_LEAST_8_CHARACTERS
```

Use the exact host from Supabase; URL-encode special characters in the database
password. Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Do not commit `.env.local`, share it in chat, or give any of these variables a
`NEXT_PUBLIC_` prefix. `.env.local` overrides `.env` for both the app and scripts.

From this app directory, using Node 22.13+:

```powershell
npm ci
npm run db:setup
```

The application tables live in the private `app` schema. Do not add this schema
to Supabase's exposed Data API schemas. The server connects directly through
the PostgreSQL pooler; no public Supabase API key is needed.

## 2. Preserve the existing event data

Stop local registration/scanning before taking the final migration snapshot.
Keep the local `data/app.db` and its WAL files together. With an empty destination:

```powershell
npm run db:migrate-sqlite
npm run seed
```

Migration opens SQLite read-only and copies users, participants, existing QR
tokens, collected-food flags, invitation settings, and the selected poster in
one PostgreSQL transaction. It refuses a destination containing users or
participants. It does not erase or modify the source database.

For a new event database, skip `db:migrate-sqlite` and just run `npm run seed`.
`seed` sets/rotates the admin and volunteer passwords supplied above; it never
creates demo participants. Old demo passwords should not be used publicly.
Posters must be PNG, JPEG, or WebP and at most 3 MB.

## 3. Deploy the updated source

The local checkout originally pointed to a different Git remote. Verify the
destination before pushing. The requested repository is:
`https://github.com/Prudhvisunku14/ganesh-chaturthi-2026.git`.

Use your intended Vercel account, import the updated repository, and select the
directory containing `package.json` as the Root Directory. Keep the Next.js
build defaults. Use Hobby; do not select a paid integration.

Set these **Production** environment variables in Vercel:

- `DATABASE_URL`: the same transaction pooler URI.
- `SESSION_SECRET`: the same generated secret.
- `SHEETS_WEBHOOK_SECRET`: the existing Google Apps Script shared secret, if used.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: your existing
  mail settings, if sending invitations by email.
- `EVENT_DATE`, `EVENT_VENUE`: the invitation details.
- `APP_BASE_URL`: leave blank to encode raw QR tokens, or set to the final HTTPS
  site URL. The scanner accepts both formats.

Keep `ADMIN_PASSWORD` and `VOLUNTEER_PASSWORD` local: they are only needed by the
seed script. Leave WhatsApp Cloud API credentials unset for the free `wa.me`
workflow. Never use a production database in untrusted preview deployments.

After the URL is assigned, update Google Apps Script's `APP_WEBHOOK_URL` and
`APP_BASE_URL` if used. Changing the base URL does not change existing QR tokens.

## 4. Verify before the event

```powershell
npm test
npm run build
```

The local tests run SQL and actual route handlers against PGlite (embedded
PostgreSQL). They check authorization, CRUD, CSV/webhook import, rollback,
posters, QR generation, and single-use claims. PGlite serializes local queries;
it does not measure Supabase network latency or multi-connection contention.

On the deployed site, use a disposable verified participant and two volunteer
phones to scan its QR simultaneously. Exactly one should show a valid pass;
the other should show already used. Also verify admin login, imports, invitation
preview, and poster retrieval. Test email separately only when ready to send.

Successful claims execute one conditional `UPDATE ... RETURNING` database query
with `payment_status = 'verified' AND food_claimed = 0`. PostgreSQL rechecks this
condition under row locking, so a QR cannot be claimed twice. The green result
remains until the volunteer presses **Ready for Next Scan**.

Sources: [Vercel regions](https://vercel.com/docs/regions),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Supabase pricing](https://supabase.com/pricing),
[Supabase pooler connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
