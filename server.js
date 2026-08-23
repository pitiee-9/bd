require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const fs = require('fs');
const path = require('path');

const app = express();
const root = __dirname;
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'public', 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const file = name => path.join(dataDir, `${name}.json`);
const read = (name, fallback = []) => { try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { fs.writeFileSync(file(name), JSON.stringify(fallback, null, 2)); return fallback; } };
const write = (name, value) => fs.writeFileSync(file(name), JSON.stringify(value, null, 2));
let wishes = read('wishes');
let visitors = read('visitors');
let gallery = read('gallery', [
  { id: 'welcome', title: 'For the brightest soul', alt: 'A warm birthday card placeholder', image: '/assets/card-warm.svg', template: 'golden-frame.html', published: true }
]);

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(root, 'public')));
app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const wishLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const clean = (value, max) => sanitizeHtml(String(value || '').trim().slice(0, max), { allowedTags: [], allowedAttributes: {} });
const templates = () => fs.readdirSync(path.join(root, 'cards')).filter(name => /\.(html|ejs)$/i.test(name)).map(name => ({ id: name, name: name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
const requireAdmin = (req, res, next) => req.session.admin ? next() : res.redirect('/admin/login');

app.get('/', (_req, res) => res.render('home', { title: 'A birthday constellation', wishes: wishes.filter(w => w.approved), gallery: gallery.filter(g => g.published), bodyClass: 'public' }));
app.get('/wish', (_req, res) => res.render('wish', { title: 'Leave a wish', error: null, success: false, values: {}, bodyClass: 'dark-page' }));
app.post('/wish', wishLimiter, (req, res) => {
  const name = clean(req.body.name, 60); const message = clean(req.body.message, 300);
  if (!name || !message) return res.status(422).render('wish', { title: 'Leave a wish', error: 'Name and message are both needed.', success: false, values: { name, message }, bodyClass: 'dark-page' });
  const now = new Date().toISOString();
  wishes.unshift({ id: `wish_${Date.now()}`, name, message, createdAt: now, approved: true });
  if (!visitors.some(visitor => visitor.name.toLowerCase() === name.toLowerCase())) visitors.push({ id: `visitor_${Date.now()}`, name, createdAt: now });
  write('wishes', wishes); write('visitors', visitors);
  res.render('wish', { title: 'Wish received', error: null, success: true, values: {}, bodyClass: 'dark-page' });
});

app.get('/admin/login', (req, res) => res.render('admin-login', { title: 'Admin access', error: null, bodyClass: 'admin-page' }));
app.post('/admin/login', loginLimiter, async (req, res) => {
  const username = clean(req.body.username, 80); const password = String(req.body.password || '');
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'; const expectedPassword = process.env.ADMIN_PASSWORD || 'change-me-before-production';
  const valid = username === expectedUser && (await bcrypt.compare(password, await bcrypt.hash(expectedPassword, 10)));
  if (!valid) return res.status(401).render('admin-login', { title: 'Admin access', error: 'Those credentials did not open the door.', bodyClass: 'admin-page' });
  req.session.admin = true; res.redirect('/admin');
});
app.post('/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.redirect('/admin/login')));
app.get('/admin', requireAdmin, (_req, res) => res.render('admin', { title: 'Control room', wishes, visitors, gallery, templates: templates(), bodyClass: 'admin-page' }));
app.post('/admin/wishes/:id/delete', requireAdmin, (req, res) => { wishes = wishes.filter(w => w.id !== req.params.id); write('wishes', wishes); res.redirect('/admin'); });
app.post('/admin/gallery', requireAdmin, upload.single('image'), (req, res) => {
  const title = clean(req.body.title, 80); const alt = clean(req.body.alt, 160); const template = templates().some(t => t.id === req.body.template) ? req.body.template : templates()[0]?.id;
  const image = req.file ? `/uploads/${req.file.filename}` : '/assets/card-warm.svg';
  gallery.unshift({ id: `gallery_${Date.now()}`, title: title || 'A birthday memory', alt: alt || title || 'Birthday memory', image, template, published: true }); write('gallery', gallery); res.redirect('/admin');
});
app.post('/admin/gallery/:id/delete', requireAdmin, (req, res) => { gallery = gallery.filter(g => g.id !== req.params.id); write('gallery', gallery); res.redirect('/admin'); });
app.get('/health', (_req, res) => res.json({ ok: true, wishes: wishes.length, gallery: gallery.length }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Birthday wishes listening at http://localhost:${port}`));
