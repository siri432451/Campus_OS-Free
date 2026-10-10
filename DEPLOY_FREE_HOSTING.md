# Run CampusOS for free (Render + Neon)

This gets CampusOS online at no cost, with no bank card, until you can afford a proper server.

| Part | Where it runs | Cost |
|---|---|---|
| Database (PostgreSQL) | Neon | Free, no expiry (0.5 GB) |
| Backend API | Render web service | Free (sleeps when idle) |
| Frontend | Render static site | Free |

> Do not use Render's own free Postgres. It expires 30 days after creation. Use Neon for the database.

Limits are current as of October 2026, but free plans change, so check the providers' pricing pages.

---

## Step 0. Put the patched code on GitHub

Replace the contents of your GitHub repo with this folder (or copy over the changed files):

| File | Change |
|---|---|
| `render.yaml` | **New.** Tells Render how to build and run both parts. |
| `DEPLOY_FREE_HOSTING.md` | **New.** This guide. |
| `backend/src/routes/payments.ts` | **Fixed.** It hard-coded `/var/www/...`, which crashes the server on most hosts. |
| `backend/src/seed.ts` | **Fixed.** Demo users no longer get public passwords (see Step 6). |
| `backend/create-registrar.js` | **Fixed.** No hard-coded password; it reads `REGISTRAR_PASSWORD`. |
| `backend/.env.example` | Tidied. |

Never commit a real `.env` file. `.gitignore` already blocks it.

## Step 1. Create the free database (Neon)

1. Sign up at **neon.com** (no card needed) and create a project. Pick a region close to Nigeria, e.g. **Europe (Frankfurt)**.
2. Open **Connection details** and copy the connection string. It looks like:
   `postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Add `&connect_timeout=15` to the end. This stops the first request failing while Neon wakes from sleep.
4. Keep this string safe. You will paste it into Render.

## Step 2. Deploy on Render

1. Sign up at **render.com** with your GitHub account.
2. Click **New → Blueprint**, choose your CampusOS repo, and Render will read `render.yaml`.
3. It will ask for the values marked "sync: false". Fill in:

   | Variable | What to enter |
   |---|---|
   | `DATABASE_URL` | The Neon string from Step 1 |
   | `ADMIN_EMAIL` | Your admin email |
   | `ADMIN_PASSWORD` | A **strong** password. You will log in with it. |
   | `FRONTEND_URL` | `https://placeholder.com` (fixed in Step 3) |
   | `VITE_API_URL` | `https://placeholder.com` (fixed in Step 3) |
   | `ANTHROPIC_API_KEY` | Optional. A **new** key if you want the AI features. |
   | `RESEND_API_KEY` | Optional. Needed only for password-reset emails. |

4. Click **Apply**. The first build takes around 5–10 minutes. The API build also creates your database tables and the first start loads the starter data.

## Step 3. Connect the two parts

The two services need each other's address, which you only learn after they exist.

1. In Render, open **campusos-api** and copy its URL (like `https://campusos-api-xxxx.onrender.com`).
2. Open **campusos-web** and copy its URL.
3. On **campusos-api → Environment**: set `FRONTEND_URL` to the **web** URL. No trailing `/`.
4. On **campusos-web → Environment**: set `VITE_API_URL` to the **api** URL. No trailing `/`.
5. On **campusos-api**, set `RUN_SEED` to `false`. (The starter data is already loaded.)
6. Redeploy both. The frontend must be rebuilt, because `VITE_` values are baked in when it is built.

## Step 4. Test

1. Open `<api URL>/health`. You should see `"status":"ok"`.
2. Open the web URL and sign in with staff ID **ADMIN001** and the `ADMIN_PASSWORD` you chose.

If the first load takes about a minute, that is the free server waking up (see Step 7).

## Step 5. Create your real accounts

Use the Admin pages (or bulk import) to add real lecturers and students.

## Step 6. Demo accounts and security

- The starter data includes demo lecturers and students. They now get **random passwords nobody knows**, so they cannot be used to log in. This is deliberate.
- If you want the old demo logins (`LEC001`, `NSG/2022/001`, etc.) for a **private** demo, set `SEED_DEMO_PASSWORDS=true` before the first seed. Do not do this on a public site.
- **Rotate any key that was on the old server.** You lost access to that machine, so create a new Anthropic API key and revoke the old one. Same for any Resend key.
- To create the Registrar account, run `create-registrar.js` with `REGISTRAR_PASSWORD` set. It no longer has a built-in password.

## Step 7. Free-plan limits (read this)

| Limit | What it means |
|---|---|
| **Sleeps after 15 minutes idle** | The first visit afterwards takes about a minute. **Open the site yourself 2 minutes before any demo.** |
| **750 free hours a month** | One service running 24/7 uses about 744 hours, so you fit if you run only one free API. |
| **Uploads are not kept** | Library books, videos, print files and payment receipts are stored on a temporary disk. They vanish on restart. The code works, but uploaded files will not last. |
| **No video/PDF thumbnails** | `ffmpeg` and `poppler` are not installed on Render's free Node runtime. Thumbnails will not generate. Nothing crashes. |
| **Admin "Site Health" page** | It reads `pm2` and `systemctl`, which don't exist here. Expect it to show errors. |
| **Wi-Fi/print features** | They only make sense on the campus network. They won't control anything from an outside server. |
| **No database backups** | Neon's free plan keeps only a 6-hour restore window. |

**Keeping it awake (optional):** a free uptime monitor such as UptimeRobot can ping `<api URL>/health` every 5 minutes. Check its current free plan.

## Step 8. Back up, so this never happens again

- **Code:** GitHub already has it.
- **Database:** once a month, run `pg_dump "<your Neon DATABASE_URL>" > campusos-backup.sql` from any computer with PostgreSQL tools, and store the file somewhere other than your laptop.
- **Secrets:** keep your `.env` values in a password manager.

## Troubleshooting

| Problem | Likely fix |
|---|---|
| Build fails with `tsc: not found` | The build command must contain `--include=dev` (it does in `render.yaml`). |
| Browser shows a CORS error | `FRONTEND_URL` doesn't exactly match the web URL (no trailing `/`, `https`). |
| Page is blank after refresh | The rewrite rule for `/*` is missing. It is in `render.yaml`. |
| Login says "Network Error" | `VITE_API_URL` is wrong or wasn't set before the frontend build. Set it and redeploy. |
| Many users get "Too many requests" | The API rate limit (200 requests per 15 minutes per address) may be counting all users as one. Raise the limit in `backend/src/index.ts`. |
| Database error right after a long idle | Neon was waking up. Retry; the `connect_timeout` in the connection string helps. |

## If you can get a proper free VPS instead

Oracle Cloud's Always Free tier gives a real server (the README's Nginx + PM2 steps work as written), and uploads would persist. The catch: signup needs a **physical** Visa/Mastercard (no virtual or prepaid cards), free capacity is often unavailable, and idle servers can be reclaimed. Try Render first; move to a VPS when you can.
