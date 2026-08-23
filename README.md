# Kessy's Birthday Wishes

A production-minded Express/EJS birthday wishes platform with a warm gallery, cyber guestbook, and protected admin control room.

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN`, `SESSION_SECRET`, and `ADMIN_PASSWORD`.
3. Run `npm install`.
4. Initialize Neon with `npm run db:init`.
5. Run `npm start` and open `http://localhost:3000`.

Default development login uses the values in `.env.example`: `admin` / `change-me-before-production`. Change them before any real deployment.

## Routes

- `/` public gallery and wishes
- `/wish` visitor submission form
- `/admin/login` admin authentication
- `/admin` dashboard
- `/health` lightweight service check

Structured data and authenticated sessions are stored in Neon PostgreSQL. Gallery image binaries are stored in Vercel Blob; Neon stores their public URL and metadata. The legacy `data/*.json` files and `public/uploads/` files are retained as migration backups and are not used by the application after migration.

The session table is created by `npm run db:init`; this is required before the first production admin login. The Vercel proxy is trusted so secure HTTPS cookies are issued correctly in production.

On Vercel, the Blob SDK prefers the project's OIDC credentials when `BLOB_STORE_ID` and the Vercel OIDC environment are available. `BLOB_READ_WRITE_TOKEN` is retained as the fallback for local development or deployments without OIDC. Neither credential is sent to browser code.

## Migrating legacy storage

Keep the existing JSON files and local uploads in place. After setting `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`, run `npm run db:init`, then run `npm run db:migrate`. The migration imports visitors, wishes, and gallery metadata, uploads legacy `/uploads/...` images to Vercel Blob, and preserves the selected template filename. It is safe to run only after reviewing the imported records; the script does not delete legacy data. Keep the backups until the Neon rows and Blob files have been verified, then archive or remove them manually.

## Card templates

Drop an `.html` or `.ejs` file into `/cards`. The admin template picker discovers it automatically at request time and uses the filename as its stable ID. Templates receive `{{image}}` and `{{alt}}` placeholders for future server-side card rendering.

## Production notes

Use HTTPS, a strong random `SESSION_SECRET`, a shared production session store, a reverse proxy, and Vercel project environment variables. Uploaded images are limited to JPEG, PNG, and WebP and 4 MB to stay below Vercel's request limit; image re-encoding and EXIF stripping should be added before accepting untrusted production uploads.
"# bd" 
