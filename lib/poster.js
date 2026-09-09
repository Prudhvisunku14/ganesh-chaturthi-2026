const { getDb } = require("./db");

// A small invitation poster persists in the private database schema.
async function readPoster(posterPath) {
  const row = await getDb().prepare("SELECT content, content_type FROM app.poster_files WHERE path = ?").get(posterPath);
  if (!row) throw new Error("Poster is unavailable. Upload it again in Invitation Settings.");
  return { content: Buffer.from(row.content), contentType: row.content_type };
}
module.exports = { readPoster };
