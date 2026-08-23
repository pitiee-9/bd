const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to use the Neon PostgreSQL storage layer.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

const mapWish = row => ({
  id: row.id,
  name: row.visitor_name,
  message: row.message,
  createdAt: row.created_at,
  approved: row.approved
});
const mapVisitor = row => ({ id: row.id, name: row.name, createdAt: row.created_at });
const mapGallery = row => ({
  id: row.id,
  title: row.title,
  alt: row.alt,
  image: row.image_url,
  originalFilename: row.original_filename,
  template: row.template,
  published: row.published,
  createdAt: row.created_at
});

async function query(text, values) {
  return pool.query(text, values);
}

async function ensureSessionTable() {
  await query(`CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL PRIMARY KEY,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
  )`);
  await query('CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")');
}

async function getApprovedWishes() {
  const { rows } = await query(`SELECT w.id, w.message, w.approved, w.created_at, v.name AS visitor_name
    FROM wishes w JOIN visitors v ON v.id = w.visitor_id
    WHERE w.approved = TRUE ORDER BY w.created_at DESC`);
  return rows.map(mapWish);
}

async function getWishes() {
  const { rows } = await query(`SELECT w.id, w.message, w.approved, w.created_at, v.name AS visitor_name
    FROM wishes w JOIN visitors v ON v.id = w.visitor_id ORDER BY w.created_at DESC`);
  return rows.map(mapWish);
}

async function getVisitors() {
  const { rows } = await query('SELECT id, name, created_at FROM visitors ORDER BY created_at DESC');
  return rows.map(mapVisitor);
}

async function getPublishedGallery() {
  const { rows } = await query('SELECT id, title, alt, image_url, original_filename, template, published, created_at FROM gallery_images WHERE published = TRUE ORDER BY created_at DESC');
  return rows.map(mapGallery);
}

async function getGallery() {
  const { rows } = await query('SELECT id, title, alt, image_url, original_filename, template, published, created_at FROM gallery_images ORDER BY created_at DESC');
  return rows.map(mapGallery);
}

async function createWish({ name, message }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const visitorResult = await client.query(`INSERT INTO visitors (name) VALUES ($1)
      ON CONFLICT ((LOWER(name))) DO UPDATE SET name = visitors.name
      RETURNING id, name, created_at`, [name]);
    const visitor = visitorResult.rows[0];
    const wishResult = await client.query(`INSERT INTO wishes (visitor_id, message, approved)
      VALUES ($1, $2, TRUE)
      RETURNING id, message, approved, created_at`, [visitor.id, message]);
    await client.query('COMMIT');
    return mapWish({ ...wishResult.rows[0], visitor_name: visitor.name });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function setWishApproval(id, approved) {
  await query('UPDATE wishes SET approved = $1 WHERE id = $2', [approved, id]);
}

async function deleteWish(id) {
  await query('DELETE FROM wishes WHERE id = $1', [id]);
}

async function createGalleryImage({ imageUrl, originalFilename, title, alt, template }) {
  const { rows } = await query(`INSERT INTO gallery_images
    (image_url, original_filename, title, alt, template, published)
    VALUES ($1, $2, $3, $4, $5, TRUE)
    RETURNING id, image_url, original_filename, title, alt, template, published, created_at`,
    [imageUrl, originalFilename, title, alt, template]);
  return mapGallery(rows[0]);
}

async function deleteGalleryImage(id) {
  const { rows } = await query('DELETE FROM gallery_images WHERE id = $1 RETURNING image_url', [id]);
  return rows[0] || null;
}

async function close() {
  await pool.end();
}

module.exports = {
  pool, query, close, ensureSessionTable, getApprovedWishes, getWishes, getVisitors, getPublishedGallery,
  getGallery, createWish, setWishApproval, deleteWish, createGalleryImage, deleteGalleryImage
};
