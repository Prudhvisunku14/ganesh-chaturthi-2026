const postgres = require("postgres");

// Application-owned SQL only. Parameter values are sent separately.
function bind(query, args) {
  const values = [];
  const named = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Buffer.isBuffer(args[0]);
  let position = 0;
  const text = query.replace(/'(?:(?:'')|[^'])*'|"(?:""|[^"])*"|\?|@([a-zA-Z_]\w*)/g, (match, name) => {
    if (match[0] === "'" || match[0] === '"') return match;
    const value = name ? args[0]?.[name] : args[position++];
    if (value === undefined) throw new Error(`Missing SQL parameter: ${name || position}`);
    if (name && !named) throw new Error("Named SQL parameters require an object");
    values.push(value);
    return `$${values.length}`;
  });
  return { text, values };
}
function createDb(client) {
  return {
    prepare(query) {
      async function execute(args, insertId = false) {
        const { text, values } = bind(query, args);
        const sql = insertId && /^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text)
          ? text.trim().replace(/;$/, "") + " RETURNING id" : text;
        return client.unsafe(sql, values);
      }
      return {
        async get(...args) { return (await execute(args))[0]; },
        async all(...args) { return Array.from(await execute(args)); },
        async run(...args) {
          const rows = await execute(args, true);
          return { changes: rows.count, lastInsertRowid: rows[0]?.id };
        },
      };
    },
    transaction(fn) {
      return (...args) => client.begin(tx => fn(createDb(tx), ...args));
    },
  };
}
let client;
let db;
function getClient() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL with your Supabase transaction pooler connection string.");
    client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: "verify-full",
      types: { int8: { to: 20, from: [20], serialize: String, parse: Number } },
    });
  }
  return client;
}
function getDb() {
  if (!db) db = createDb(getClient());
  return db;
}
module.exports = { getDb, getClient, createDb, bind };
