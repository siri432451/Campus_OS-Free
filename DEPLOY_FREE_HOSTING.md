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
| `backend/src/routes/users.ts` | **Fixed.** Profile-photo folder was also hard-coded to `/var/www/...`. |
| `backend/src/seed.ts` | **Fixed.** Demo users no longer get public passwords (see Step 6). Also adds a safe admin-password reset switch (see Troubleshooting). |
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
| Need the Registrar account (`REG001`) | Same method: add `REGISTRAR_PASSWORD` (at least 10 characters, typed by hand) and optionally `REGISTRAR_NAME` / `REGISTRAR_EMAIL`, set `RUN_SEED` = `true`, save, look for "Registrar: REG001" in the logs, then set `RUN_SEED` back to `false`. |
| Need the School Admin account (`ADMIN002`) | On **campusos-api → Environment** add `SCHOOL_ADMIN_PASSWORD` (strong, typed by hand) and optionally `SCHOOL_ADMIN_NAME` / `SCHOOL_ADMIN_EMAIL`, set `RUN_SEED` = `true`, save. The logs should show "School Admin: ADMIN002". Then set `RUN_SEED` back to `false`. Existing users are never changed by the seed. |
| Admin login says "Invalid credentials" | The seed never changes an existing account's password. To reset: on **campusos-api → Environment** set `ADMIN_PASSWORD` to a new password, add `RESET_ADMIN_PASSWORD` = `true`, set `RUN_SEED` = `true`, save and let it redeploy. When the logs show "Admin password was reset" and you can log in, set `RESET_ADMIN_PASSWORD` and `RUN_SEED` back to `false`. |
| Many users get "Too many requests" | The API rate limit (200 requests per 15 minutes per address) may be counting all users as one. Raise the limit in `backend/src/index.ts`. |
| Database error right after a long idle | Neon was waking up. Retry; the `connect_timeout` in the connection string helps. |

## If you can get a proper free VPS instead

Oracle Cloud's Always Free tier gives a real server (the README's Nginx + PM2 steps work as written), and uploads would persist. The catch: signup needs a **physical** Visa/Mastercard (no virtual or prepaid cards), free capacity is often unavailable, and idle servers can be reclaimed. Try Render first; move to a VPS when you can.

## Transcript settings (optional)

Defaults are built in. To change any of them, add the variable on **campusos-api → Environment** and save.

| Variable | What it controls | Default |
|---|---|---|
| `TRANSCRIPT_INSTITUTION` | Name printed at the top of transcripts | OSUN STATE COLLEGE OF NURSING SCIENCES |
| `TRANSCRIPT_ADDRESS` | Address lines, separated by `\|` | P.M.B 4405\|OSOGBO, OSUN STATE, NIGERIA |
| `TRANSCRIPT_CONTACT` | One extra line, e.g. telephone and email | (none) |
| `TRANSCRIPT_FEE_SELF` | Fee when sent to the applicant (naira) | 20000 |
| `TRANSCRIPT_FEE_INSTITUTION` | Fee when sent to another institution (naira) | 40000 |
| `TRANSCRIPT_BANK`, `TRANSCRIPT_ACCOUNT_NUMBER`, `TRANSCRIPT_ACCOUNT_NAME` | Payment details shown on the public request page | set in the code |

Public pages: `/request-transcript` (request), `/track-transcript` (track and download) and `/verify/<code>` (QR verification).
The Registrar's signature and stamp go in `backend/assets/` (see the README there).

## Email setup (Resend + your Hostinger domain)

Render's free plan blocks normal mail ports, so CampusOS sends mail through **Resend** (free: 100 emails a day, 3,000 a month; check their pricing page for changes). Your Hostinger mailbox and its existing records are not touched.

**1. Add the domain in Resend**
1. Sign up at **resend.com** and open **Domains → Add Domain**. Enter `campusos.space` and pick a region (Europe is closest).
2. Resend shows a few DNS records: a `TXT` record named `resend._domainkey`, an `MX` record and a `TXT` record both named `send`. Keep that page open.

**2. Add those records in Hostinger**
1. hPanel → **Domains → campusos.space → DNS / Nameservers → DNS records**.
2. Click **Add record** for each one from Resend. In the **Name** box type only the part before the domain (`send` or `resend._domainkey`). For the MX record also enter its priority (10).
3. **Do not delete or change** the records that are already there (Hostinger's MX, SPF, DKIM and DMARC records). They keep your mailbox working.
4. Back in Resend click **Verify DNS Records**. It can take a few minutes, sometimes a few hours.

**3. Create the key and give it to the server**
1. In Resend: **API Keys → Create API Key**. Name it `campusos`, permission **Sending access**, domain `campusos.space`. Copy the key now, because it is shown only once.
2. In Render: **campusos-api → Environment**. Replace the value of `RESEND_API_KEY` (it says `not-set-yet`) with the real key.
3. Add `MAIL_REPLY_TO` and set it to a real mailbox that people can reply to (for example one you create in Hostinger). Optionally set `MAIL_FROM` (default: `CampusOS Registry <registry@campusos.space>`).
4. Save. The API redeploys by itself.

**4. What the system emails**
- A confirmation with the tracking code, when a request is submitted.
- The official PDF, when the Registrar approves a request: to the applicant, or to the receiving institution (the applicant then gets a notice).
- The reason, when a request is rejected.
- The student verification codes and welcome emails that were already built into CampusOS.

If an email fails, the transcript is still issued. The Registrar's request page shows the error and a **Send by email** button for retrying or using a corrected address.
