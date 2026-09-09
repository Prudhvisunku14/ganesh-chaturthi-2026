require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const { getClient } = require("../lib/db");
const template = require("../lib/invitation-default");

async function main() {
  const sql = getClient();
  try {
    await sql.begin(async tx => {
      await tx.unsafe(await fs.readFile(path.join(__dirname, "../supabase/schema.sql"), "utf8")).simple();
      await tx`INSERT INTO app.invitation_settings (id, message_template) VALUES (1, ${template}) ON CONFLICT (id) DO NOTHING`;
    });
    console.log("Supabase schema ready. Existing data was preserved.");
  } finally { await sql.end(); }
}
main().catch(() => { console.error("Database setup failed. Check DATABASE_URL and database connectivity."); process.exitCode = 1; });
