// Run after db:setup using Node 22.13+. Source database is opened read-only.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs/promises");
const path = require("node:path");
const { getClient } = require("../lib/db");

async function main() {
  const source = new DatabaseSync(path.resolve("data/app.db"), { readOnly: true });
  const sql = getClient();
  try {
    const users = source.prepare("SELECT * FROM users").all();
    const participants = source.prepare("SELECT * FROM participants").all();
    const settings = source.prepare("SELECT * FROM invitation_settings WHERE id = 1").get();
    let poster;
    if (settings?.poster_path) {
      const root = path.resolve("poster");
      const file = path.resolve(settings.poster_path);
      if (!file.startsWith(root + path.sep)) throw new Error("Invalid poster path");
      const content = await fs.readFile(file);
      if (content.length > 3 * 1024 * 1024) throw new Error("Resize the poster to under 3 MB before migrating");
      const ext = path.extname(file).toLowerCase();
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext];
      if (!type) throw new Error("Unsupported poster format");
      poster = { path: settings.poster_path, content, content_type: type };
    }
    await sql.begin(async tx => {
      await tx`LOCK TABLE app.users, app.participants, app.invitation_settings, app.poster_files IN ACCESS EXCLUSIVE MODE`;
      const [count] = await tx`SELECT (SELECT COUNT(*) FROM app.users) + (SELECT COUNT(*) FROM app.participants) AS total`;
      if (Number(count.total)) throw new Error("Destination is not empty; migration stopped to preserve data");
      if (users.length) await tx`INSERT INTO app.users ${tx(users)}`;
      if (participants.length) await tx`INSERT INTO app.participants ${tx(participants)}`;
      if (settings) {
        await tx`DELETE FROM app.invitation_settings WHERE id = 1`;
        await tx`INSERT INTO app.invitation_settings ${tx(settings)}`;
      }
      if (poster) await tx`INSERT INTO app.poster_files ${tx(poster)}`;
      for (const table of ["users", "participants"]) {
        await tx.unsafe(`SELECT setval(pg_get_serial_sequence('app.${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM app.${table}`);
      }
    });
    console.log(`Migrated ${users.length} users and ${participants.length} participants, preserving QR tokens and claims. Source unchanged.`);
  } finally { source.close(); await sql.end(); }
}
main().catch(error => { console.error("Migration failed; destination transaction rolled back.", error.code || "Check source data and connection settings."); process.exitCode = 1; });
