const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');
const { createDb, bind } = require('../lib/db');
const { CLAIM_SQL } = require('../lib/claim');
const { NextRequest } = require('next/server');
const XLSX = require('xlsx');
const auth = require('../lib/auth');
process.env.SESSION_SECRET = 'test-only-secret-'.repeat(4);
process.env.SHEETS_WEBHOOK_SECRET = 'test-webhook';

function adapter(pg) {
  return {
    async unsafe(sql, args) {
      const result = await pg.query(sql, args);
      result.rows.count = result.affectedRows ?? result.rows.length;
      return result.rows;
    },
    begin(fn) { return pg.transaction(tx => fn(adapter(tx))); },
  };
}

// Load the actual route handlers with an isolated PostgreSQL database. No
// production credentials, network services, emails, or real participants.
function loadRoute(relative, db) {
  const filename = path.resolve('app/api', relative, 'route.js');
  let source = fs.readFileSync(filename, 'utf8');
  source = source.replace(/import\s+(.+?)\s+from\s+["'](.+?)["'];/g, (_, names, target) => {
    const binding = names.startsWith('{') ? names.replace(/\bas\b/g, ':') : names;
    return `const ${binding} = require(${JSON.stringify(target)});`;
  }).replace(/export /g, '');
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(name => source.includes(`function ${name}(`));
  source += '\nmodule.exports = {' + methods.join(',') + '};';
  const context = { module: { exports: {} }, Buffer, URL, Date, console, process, Response, FormData };
  context.require = target => {
    if (target.endsWith('/lib/db')) return { getDb: () => db };
    return require(target.startsWith('.') ? path.resolve(path.dirname(filename), target) : target);
  };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}
function request(route, method, body, role = 'admin') {
  const headers = {};
  if (role) headers.cookie = `${auth.COOKIE_NAME}=${auth.createSessionToken({ id: 1, username: role, role })}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new NextRequest(`https://example.test/api/${route}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

function fileRequest(route, fileName, bytes, role = 'admin') {
  const formData = new FormData();
  formData.append('file', new Blob([bytes]), fileName);
  return new NextRequest(`https://example.test/api/${route}`, {
    method: 'POST',
    headers: { cookie: `${auth.COOKIE_NAME}=${auth.createSessionToken({ id: 1, username: role, role })}` },
    body: formData,
  });
}

test('SQL values stay parameterized, including repeated names and quoted markers', () => {
  const query = bind("SELECT '?' WHERE name = @name OR phone = @name", [{ name: "' OR 1=1 --" }]);
  assert.equal(query.text, "SELECT '?' WHERE name = $1 OR phone = $2");
  assert.deepEqual(query.values, ["' OR 1=1 --", "' OR 1=1 --"]);
});

test('PostgreSQL schema and application workflows', async t => {
  const pg = new PGlite();
  await pg.exec(fs.readFileSync('supabase/schema.sql', 'utf8'));
  const db = createDb(adapter(pg));
  await db.prepare('INSERT INTO invitation_settings (id, message_template) VALUES (1, ?)').run('Hello {NAME}');
  await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run('admin', auth.hashPassword('test-password-123'));
  try {
    await t.test('authentication and authorization', async () => {
      const login = loadRoute('auth/login', db);
      assert.equal((await login.POST(request('auth/login', 'POST', { username: 'admin', password: 'wrong' }, null))).status, 401);
      const response = await login.POST(request('auth/login', 'POST', { username: 'admin', password: 'test-password-123' }, null));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
      const participants = loadRoute('participants', db);
      assert.equal((await participants.POST(request('participants', 'POST', {}, 'volunteer'))).status, 401);
    });
    let id;
    let token;
    await t.test('create, edit, case-insensitive search, verify and QR generation', async () => {
      const participants = loadRoute('participants', db);
      const created = await (await participants.POST(request('participants', 'POST', { name: 'Test Attendee', phone: '9000000001' }))).json();
      assert.ok(created.id);
      id = created.id;
      const detail = loadRoute('participants/[id]', db);
      const params = Promise.resolve({ id: String(id) });
      assert.equal((await detail.PATCH(request('participants', 'PATCH', { program: 'MSc' }), { params })).status, 200);
      const rows = await (await participants.GET(request('participants?search=attendee', 'GET'))).json();
      assert.equal(rows.participants.length, 1);
      const verify = loadRoute('participants/[id]/verify', db);
      const result = await (await verify.POST(request('participants', 'POST', { action: 'verify' }), { params })).json();
      token = result.qr_token;
      assert.ok(token);
      const qr = loadRoute('participants/[id]/qr', db);
      assert.equal((await qr.GET(request('participants', 'GET'), { params })).status, 200);
    });
    await t.test('20 competing claims yield exactly one success; pending and rejected cannot claim', async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => db.prepare(CLAIM_SQL).get(1, token)));
      assert.equal(results.filter(Boolean).length, 1);
      const scanner = loadRoute('scanner/verify', db);
      const used = await (await scanner.POST(request('scanner/verify', 'POST', { token }, 'volunteer'))).json();
      assert.equal(used.result, 'already_used');
      for (const status of ['pending', 'rejected']) {
        await db.prepare('INSERT INTO participants (registration_id, name, phone, payment_status, qr_token) VALUES (?, ?, ?, ?, ?)').run(status, status, status, status, status);
        assert.equal(await db.prepare(CLAIM_SQL).get(1, status), undefined);
        const response = await (await scanner.POST(request('scanner/verify', 'POST', { token: status }, 'volunteer'))).json();
        assert.equal(response.result, 'not_eligible');
      }
      const missing = await (await scanner.POST(request('scanner/verify', 'POST', { token: 'missing' }, 'volunteer'))).json();
      assert.equal(missing.result, 'invalid_unrecognized');
    });
    await t.test('CSV/XLSX import, duplicates, webhook, stats, history and export', async () => {
      const importer = loadRoute('participants/import', db);
      const result = await (await importer.POST(request('participants/import', 'POST', { csv: 'Name,Mobile Number,Programme\nCSV Attendee,9000000002,BSc\nDuplicate,9000000002,BSc\nInvalid,,BSc' }))).json();
      assert.equal(result.imported, 2);
      assert.equal(result.skipped_duplicates, 0);
      assert.equal(result.skipped_invalid, 1);

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet([
        { Name: 'First XLSX', 'Mobile Number': '9000000004', Programme: 'BTech' },
        { Name: 'Second XLSX', 'Mobile Number': '9000000004', Programme: 'BTech' },
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Participants');
      const xlsxBytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const xlsxResult = await (await importer.POST(fileRequest('participants/import', 'participants.xlsx', xlsxBytes))).json();
      assert.equal(xlsxResult.imported, 2);
      assert.equal(xlsxResult.skipped_duplicates, 0);
      const webhook = loadRoute('participants/webhook', db);
      assert.equal((await webhook.POST(request('participants/webhook', 'POST', {}, null))).status, 401);
      const response = await (await webhook.POST(request('participants/webhook', 'POST', { secret: 'test-webhook', name: 'Webhook', phone: '9000000003' }, null))).json();
      assert.equal(response.status, 'created');
      const stats = await (await loadRoute('stats', db).GET(request('stats', 'GET'))).json();
      assert.equal(Number(stats.food_collected), 1);
      const history = await (await loadRoute('food-history', db).GET(request('food-history', 'GET'))).json();
      assert.equal(history.history.length, 1);
      assert.match(await (await loadRoute('participants/export', db).GET(request('participants/export', 'GET'))).text(), /Test Attendee/);
    });
    await t.test('transaction rolls back all inserts on failure', async () => {
      await assert.rejects(db.transaction(async tx => {
        await tx.prepare("INSERT INTO participants (registration_id, name, phone) VALUES ('rollback', 'Rollback', '9000000004')").run();
        throw new Error('intentional rollback');
      })());
      assert.equal(await db.prepare("SELECT id FROM participants WHERE registration_id = 'rollback'").get(), undefined);
    });
    await t.test('poster bytes persist and delete together with settings', async () => {
      const route = loadRoute('invitation-settings', db);
      const form = new FormData();
      form.append('poster', new Blob([Buffer.from([137, 80, 78, 71])], { type: 'image/png' }), 'poster.png');
      const req = request('invitation-settings', 'POST');
      req.formData = async () => form;
      assert.equal((await route.POST(req)).status, 200);
      const stored = await db.prepare('SELECT * FROM poster_files').get();
      assert.deepEqual(Buffer.from(stored.content), Buffer.from([137, 80, 78, 71]));
      assert.equal((await route.DELETE(request('invitation-settings', 'DELETE'))).status, 200);
      assert.equal((await db.prepare('SELECT * FROM poster_files').all()).length, 0);
    });
  } finally { await pg.close(); }
});
