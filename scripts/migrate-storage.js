require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { put, del } = require('@vercel/blob');
const { pool } = require('../db');

const root = path.join(__dirname, '..');
const dataPath = name => path.join(root, 'data', `${name}.json`);
const readLegacy = name => {
  try { return JSON.parse(fs.readFileSync(dataPath(name), 'utf8')); }
  catch { return []; }
};
const legacyFileFromUrl = image => {
  if (!image || !image.startsWith('/uploads/')) return null;
  return path.join(root, 'public', image.replace(/^\//, '').replaceAll('/', path.sep));
};

async function findOrCreateVisitor(client, name) {
  const { rows } = await client.query(`INSERT INTO visitors (name) VALUES ($1)
    ON CONFLICT ((LOWER(name))) DO UPDATE SET name = visitors.name
    RETURNING id, name`, [String(name || '').trim().slice(0, 100)]);
  return rows[0];
}

async function migrate() {
  const wishes = readLegacy('wishes');
  const visitors = readLegacy('visitors');
  const gallery = readLegacy('gallery');
  const client = await pool.connect();
  const uploadedUrls = [];
  try {
    await client.query('BEGIN');
    for (const visitor of visitors) await findOrCreateVisitor(client, visitor.name);
    for (const wish of wishes) {
      const visitor = await findOrCreateVisitor(client, wish.name || wish.visitor_name);
      await client.query(`INSERT INTO wishes (visitor_id, message, approved, created_at)
        VALUES ($1, $2, $3, COALESCE($4, NOW()))`, [visitor.id, wish.message, Boolean(wish.approved), wish.createdAt || null]);
    }
    for (const item of gallery) {
      let imageUrl = item.image;
      const localFile = legacyFileFromUrl(item.image);
      if (localFile && fs.existsSync(localFile)) {
        const blob = await put(`gallery/${path.basename(localFile)}`, fs.readFileSync(localFile), {
          access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: true
        });
        imageUrl = blob.url;
        uploadedUrls.push(imageUrl);
      }
      await client.query(`INSERT INTO gallery_images
        (image_url, original_filename, title, alt, template, published)
        VALUES ($1, $2, $3, $4, $5, $6)`, [
        imageUrl, item.originalFilename || (localFile && path.basename(localFile)) || null,
        item.title || 'A birthday memory', item.alt || 'Birthday memory', item.template, item.published !== false
      ]);
    }
    await client.query('COMMIT');
    console.log(`Migrated ${wishes.length} wishes, ${visitors.length} visitors, and ${gallery.length} gallery records.`);
  } catch (error) {
    await client.query('ROLLBACK');
    for (const url of uploadedUrls) {
      try { await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (cleanupError) { console.error('Blob cleanup failed:', cleanupError.message); }
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => { console.error('Storage migration failed:', error.message); process.exitCode = 1; });
