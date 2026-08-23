# Kessy's Birthday Wishes

A production-minded Express/EJS birthday wishes platform with a warm gallery, cyber guestbook, and protected admin control room.

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env` and change `SESSION_SECRET` and `ADMIN_PASSWORD`.
3. Run `npm install`.
4. Run `npm start` and open `http://localhost:3000`.

Default development login uses the values in `.env.example`: `admin` / `change-me-before-production`. Change them before any real deployment.

## Routes

- `/` public gallery and wishes
- `/wish` visitor submission form
- `/admin/login` admin authentication
- `/admin` dashboard
- `/health` lightweight service check

Data is stored in `data/*.json` for a zero-setup local experience. For production, replace the small persistence functions in `server.js` with PostgreSQL or another managed store, and configure a shared session store.

## Card templates

Drop an `.html` or `.ejs` file into `/cards`. The admin template picker discovers it automatically at request time and uses the filename as its stable ID. Templates receive `{{image}}` and `{{alt}}` placeholders for future server-side card rendering.

## Production notes

Use HTTPS, a strong random `SESSION_SECRET`, a managed session store, a reverse proxy, and a persistent database. Uploaded images are limited to JPEG, PNG, and WebP and 5 MB; image re-encoding and EXIF stripping should be added before accepting untrusted production uploads.
"# bd" 
