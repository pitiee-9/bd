require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const fs = require('fs');
const path = require('path');
const { put, del } = require('@vercel/blob');
const db = require('./db');
const { getBlobOptions } = require('./blob-storage');

const app = express();
const root = __dirname;

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(root, 'public')));
app.use(session({ store: new PgSession({ pool: db.pool, createTableIfMissing: true }), secret: process.env.SESSION_SECRET || 'development-only-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const wishLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const clean = (value, max) => sanitizeHtml(String(value || '').trim().slice(0, max), { allowedTags: [], allowedAttributes: {} });
const templates = () => fs.readdirSync(path.join(root, 'cards')).filter(name => /\.(html|ejs)$/i.test(name)).map(name => ({ id: name, name: name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
const requireAdmin = (req, res, next) => req.session.admin ? next() : res.redirect('/admin/login');
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/', asyncRoute(async (_req, res) => res.render('home', { title: 'A birthday constellation', wishes: await db.getApprovedWishes(), gallery: await db.getPublishedGallery(), bodyClass: 'public' })));
app.get('/wish', (_req, res) => res.render('wish', { title: 'Leave a wish', error: null, success: false, values: {}, bodyClass: 'dark-page' }));
app.post('/wish', wishLimiter, asyncRoute(async (req, res) => {
  const name = clean(req.body.name, 60); const message = clean(req.body.message, 300);
  if (!name || !message) return res.status(422).render('wish', { title: 'Leave a wish', error: 'Name and message are both needed.', success: false, values: { name, message }, bodyClass: 'dark-page' });
  await db.createWish({ name, message });
  res.render('wish', { title: 'Wish received', error: null, success: true, values: {}, bodyClass: 'dark-page' });
}));

app.get('/admin/login', (req, res) => res.render('admin-login', { title: 'Admin access', error: null, bodyClass: 'admin-page' }));
app.post('/admin/login', loginLimiter, async (req, res) => {
  const username = clean(req.body.username, 80); const password = String(req.body.password || '');
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'; const expectedPassword = process.env.ADMIN_PASSWORD || 'change-me-before-production';
  const valid = username === expectedUser && (await bcrypt.compare(password, await bcrypt.hash(expectedPassword, 10)));
  if (!valid) return res.status(401).render('admin-login', { title: 'Admin access', error: 'Those credentials did not open the door.', bodyClass: 'admin-page' });
  req.session.admin = true; res.redirect('/admin');
});
app.post('/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.redirect('/admin/login')));
app.get('/admin', requireAdmin, asyncRoute(async (_req, res) => res.render('admin', { title: 'Control room', wishes: await db.getWishes(), visitors: await db.getVisitors(), gallery: await db.getGallery(), templates: templates(), bodyClass: 'admin-page' })));
app.post('/admin/wishes/:id/delete', requireAdmin, asyncRoute(async (req, res) => { await db.deleteWish(req.params.id); res.redirect('/admin'); }));
app.post('/admin/wishes/:id/approve', requireAdmin, asyncRoute(async (req, res) => { await db.setWishApproval(req.params.id, true); res.redirect('/admin'); }));
app.post('/admin/gallery', requireAdmin, upload.single('image'), asyncRoute(async (req, res) => {
  const title = clean(req.body.title, 80); const alt = clean(req.body.alt, 160); const template = templates().some(t => t.id === req.body.template) ? req.body.template : templates()[0]?.id;
  if (!template) return res.status(422).render('admin', { title: 'Control room', wishes: await db.getWishes(), visitors: await db.getVisitors(), gallery: await db.getGallery(), templates: templates(), bodyClass: 'admin-page' });
  if (!req.file) return res.status(422).send('An image is required.');
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const blob = await put(`gallery/${Date.now()}-${safeName}`, req.file.buffer, { ...getBlobOptions(), addRandomSuffix: true, contentType: req.file.mimetype });
  try {
    await db.createGalleryImage({ imageUrl: blob.url, originalFilename: req.file.originalname, title: title || 'A birthday memory', alt: alt || title || 'Birthday memory', template });
  } catch (error) {
    try { await del(blob.url, getBlobOptions()); } catch (cleanupError) { console.error('Blob cleanup failed:', cleanupError.message); }
    throw error;
  }
  res.redirect('/admin');
}));
app.post('/admin/gallery/:id/delete', requireAdmin, asyncRoute(async (req, res) => {
  const deleted = await db.deleteGalleryImage(req.params.id);
  if (deleted?.image_url?.includes('.blob.vercel-storage.com')) {
    try { await del(deleted.image_url, getBlobOptions()); }
    catch (error) { console.error('Blob deletion failed:', error.message); }
  }
  res.redirect('/admin');
}));
app.get('/health', asyncRoute(async (_req, res) => { await db.query('SELECT 1'); res.json({ ok: true }); }));

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).send('Image must be 4 MB or smaller.');
  if (error instanceof multer.MulterError || error.message === 'Unexpected field') return res.status(400).send('That image upload was not accepted.');
  res.status(500).send('Something went wrong while processing that request.');
});

const port = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(port, () => console.log(`Birthday wishes listening at http://localhost:${port}`));

module.exports = app;
