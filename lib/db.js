// lib/db.js
//
// SQLite is used for local/dev/demo purposes so the app runs with zero
// external setup. The schema below is written to be trivially portable to
// Postgres/Supabase — see the "SWITCHING TO SUPABASE / POSTGRES" note at the
// bottom of this file for the exact changes needed at deploy time.

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let _db;

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  // NORMAL is safe (not just fast) under WAL: a crash can lose only the last
  // few commits, never corrupt the DB. Cuts the fsync cost of every claim
  // write, which matters when several volunteer devices scan concurrently.
  _db.pragma("synchronous = NORMAL");
  // Without this, a second writer that arrives while another claim is being
  // committed fails immediately with SQLITE_BUSY instead of waiting a few ms
  // for its turn — exactly the failure mode multiple simultaneous scanners
  // would otherwise hit.
  _db.pragma("busy_timeout = 5000");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      year TEXT,
      program TEXT,
      department TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'verified', 'rejected')),
      payment_proof_url TEXT,
      qr_token TEXT UNIQUE,
      whatsapp_sent INTEGER NOT NULL DEFAULT 0,
      whatsapp_sent_at TEXT,
      email_sent INTEGER NOT NULL DEFAULT 0,
      email_sent_at TEXT,
      food_claimed INTEGER NOT NULL DEFAULT 0,
      claimed_at TEXT,
      claimed_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_participants_phone ON participants(phone);
    CREATE INDEX IF NOT EXISTS idx_participants_qr_token ON participants(qr_token);
    CREATE INDEX IF NOT EXISTS idx_participants_payment_status ON participants(payment_status);
  `);

  const cols = _db.prepare("PRAGMA table_info(participants)").all();
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("email")) {
    _db.exec("ALTER TABLE participants ADD COLUMN email TEXT");
  }
  if (!colNames.includes("email_sent")) {
    _db.exec("ALTER TABLE participants ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.includes("email_sent_at")) {
    _db.exec("ALTER TABLE participants ADD COLUMN email_sent_at TEXT");
  }

  return _db;
}

module.exports = { getDb, DB_PATH };

// ---------------------------------------------------------------------------
// SWITCHING TO SUPABASE / POSTGRES
// ---------------------------------------------------------------------------
// 1. Run the same CREATE TABLE statements above through the Supabase SQL
//    editor, with two syntax changes:
//      - `INTEGER PRIMARY KEY AUTOINCREMENT`  ->  `SERIAL PRIMARY KEY`
//      - `datetime('now')`                    ->  `now()`  (timestamptz)
// 2. Install `@supabase/supabase-js` (server-side, using the SERVICE ROLE key
//    — never the anon key — and never expose it to the client/browser).
// 3. Replace every `getDb().prepare(...).run/get/all(...)` call in the `app/api`
//    routes with the equivalent `supabase.from('participants').select/insert/
//    update(...)` call. The atomic "claim food" update in
//    app/api/scanner/verify/route.js is the one query that matters most for
//    correctness — in Postgres/Supabase, do it as:
//
//      const { data, error } = await supabase
//        .from('participants')
//        .update({ food_claimed: true, claimed_at: new Date().toISOString(), claimed_by_user_id })
//        .eq('qr_token', token)
//        .eq('food_claimed', false)
//        .select()
//        .single();
//
//      // if `data` is null / error is "no rows", someone else already claimed it.
//
//    This relies on Postgres row-level locking during the UPDATE, exactly
//    like the SQLite version below, so no other code changes are needed.
// ---------------------------------------------------------------------------
