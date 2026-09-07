// scripts/seed.js
// Run with: npm run seed
// Creates default admin/volunteer logins and a handful of demo participants
// in various states so the dashboard is testable immediately.

require("dotenv").config();
const { getDb } = require("../lib/db");
const { hashPassword } = require("../lib/auth");
const { generateSecureToken } = require("../lib/qr");

const db = getDb();

function upsertUser(username, password, role) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    console.log(`User '${username}' already exists, skipping.`);
    return;
  }
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
  ).run(username, hashPassword(password), role);
  console.log(`Created ${role} user: ${username} / ${password}`);
}

upsertUser("admin", "admin123", "admin");
upsertUser("volunteer", "volunteer123", "volunteer");

const demoParticipants = [
  { name: "Prudhvi Raj", phone: "9876543210", year: "4th Year", program: "B.Tech", department: "Maths & Computing", payment_status: "verified" },
  { name: "Rahul Sharma", phone: "9876543211", year: "3rd Year", program: "B.Tech", department: "Civil Engineering", payment_status: "verified" },
  { name: "Anjali Mehta", phone: "9876543212", year: "2nd Year", program: "M.Tech", department: "Data Science", payment_status: "pending" },
  { name: "Karan Verma", phone: "9876543213", year: "1st Year", program: "B.Tech", department: "Electrical Engineering", payment_status: "rejected" },
  { name: "Sneha Patil", phone: "9876543214", year: "5th Year", program: "PhD", department: "Physics", payment_status: "verified" },
];

const insert = db.prepare(`
  INSERT INTO participants
    (registration_id, name, phone, year, program, department, payment_status, qr_token)
  VALUES (@registration_id, @name, @phone, @year, @program, @department, @payment_status, @qr_token)
`);

const existingCount = db.prepare("SELECT COUNT(*) AS c FROM participants").get().c;
if (existingCount > 0) {
  console.log(`participants table already has ${existingCount} rows, skipping demo data.`);
} else {
  demoParticipants.forEach((p, i) => {
    insert.run({
      registration_id: `REG-DEMO-${String(i + 1).padStart(3, "0")}`,
      qr_token: p.payment_status === "verified" ? generateSecureToken() : null,
      ...p,
    });
  });
  console.log(`Inserted ${demoParticipants.length} demo participants.`);
}

console.log("\nSeed complete. Login at /login with:");
console.log("  admin      / admin123      (full dashboard)");
console.log("  volunteer  / volunteer123  (scanner only)");
