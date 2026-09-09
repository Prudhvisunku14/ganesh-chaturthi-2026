require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { getClient } = require('../lib/db');
const { hashPassword } = require('../lib/auth');
async function main() {
  const admin = process.env.ADMIN_PASSWORD;
  const volunteer = process.env.VOLUNTEER_PASSWORD;
  if (!admin || admin.length < 8 || !volunteer || volunteer.length < 8) {
    throw new Error('Set ADMIN_PASSWORD and VOLUNTEER_PASSWORD to distinct passwords of at least 8 characters.');
  }
  if (admin === volunteer) throw new Error('Use different passwords for admin and volunteer.');
  const sql = getClient();
  try {
    await sql.begin(async tx => {
      for (const [username, password, role] of [['admin', admin, 'admin'], ['volunteer', volunteer, 'volunteer']]) {
        await tx`INSERT INTO app.users (username, password_hash, role)
          VALUES (${username}, ${hashPassword(password)}, ${role})
          ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`;
      }
    });
    console.log('Admin and volunteer passwords set. No demo participants were added.');
  } finally { await sql.end(); }
}
main().catch(error => {
  console.error('User setup failed:', error.message);
  process.exitCode = 1;
});
