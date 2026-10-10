# CampusOS Roadmap

Last updated: end of session that shipped admin Slice 4 (commit `4a7341d`).

## What's already shipped (as of today)

- Splash + Login (Round 5.5 redesign)
- Student dashboard (mobile + desktop, role-aware)
- Library, Results, Digital ID, Announcements, AI Chat, Flashcards (22 decks live), Simulation route (no content yet)
- Print system: student upload → operator queue → operator marks done; balance shown on wallet page
- Paystack top-up (test mode keys; live keys ready when domain verified)
- Resend email integration (test mode: only delivers to ogunadeprecious@gmail.com until domain verified)
- Email verification onboarding (page reachable at `/onboarding/email`; no auto-redirect yet)
- Dashboard banner prompting unverified users to verify
- Admin dashboard (read-only stats: people, printing, revenue for super admin)
- Admin: "+ New Student" form (single creation with welcome email; first real student: Ogundele NSG/2026/010)

## Next features — priority order

Each is its own focused session. Do NOT combine.

### A — Students list in admin (~2h, low risk)
Read-only table of all students with filters (level, department, active/inactive, verified/not), search by name/matric.

### B — Lecturers list in admin (~2h, low risk)
Same pattern as A but for lecturers. Grouped by department. Each row shows: name, staff ID, department, classes/courses they teach (if linked).

### C — Lecturer CRUD (~3h, medium)
Admin creates, edits, deactivates lecturers. Uses same welcome-email pattern as student creation.

### D — HOD assignment (~1.5h, low)
One HOD per department. Requires adding `is_hod boolean` field (or similar) to users. Admin assigns by clicking lecturer in list B → "Mark as HOD" — system unmarks any previous HOD in that department.

### E — Role permission split: SUPER_ADMIN vs SCHOOL_ADMIN (~2h, medium)
Currently both see same admin pages. Need to split:
- SUPER_ADMIN: sees everything (cross-school view, revenue, system health, can manage admins)
- SCHOOL_ADMIN: sees only their school's students/lecturers, no revenue, no admin-management

Do this BEFORE student messaging so we know who messages reach.

### F — Bulk CSV student import (~3-5h, medium)
Admin uploads `.csv` with name/matric/level/department/email columns. Backend parses, validates, previews, then on confirm batch-creates accounts + sends welcome emails. Must handle partial failures (some rows succeed, some fail) gracefully.

### G — Student → super admin messaging with image attachments (~4-6h, medium-high)
New `support_tickets` table. Student creates ticket: text + optional image upload. Super admin sees inbox, replies. Possibly notifies via email when admin replies.

### H — Site health / error monitoring (~2-4h, medium)
Super admin page showing: backend uptime, recent errors, slow endpoints, disk usage, DB connection status. Could pull from pm2 logs + Postgres `pg_stat_statements`.

### I — Forgot password flow (~1.5h, medium)
Uses the email verification infrastructure already built. Login page → "Forgot password" link → enter matric → code to verified email → set new password.

### J — Forced password change on first login (~1.5h, HIGH RISK)
Auto-redirect users with `password_changed_at IS NULL` to `/onboarding/password`. **This is the trap that broke us twice** — touches ProtectedRoute + AuthContext. Must be done carefully, alone, well-rested, with no other changes in same commit.

### K — Auto-redirect unverified to /onboarding/email (~1h, HIGH RISK)
Same trap as J. Forces email verification before access. Do J first since the page is already built.

### L — Refund on print job cancel (~30m, low)
When operator cancels a queued/printing job, credit the student back the `credit_cost`.

### M — Domain verification with Resend (~30m config + DNS wait, low)
Verify a domain (e.g. campusos.com.ng) in Resend so emails can deliver to anyone, not just `ogunadeprecious@gmail.com`. Unblocks G, I, J, K for real students.

### N — Last 8 HND clinical flashcard decks (~2h content work, low code)
Drug Interactions, ADRs, PPH Mgmt, Pre-eclampsia/Eclampsia, Patient Deterioration, Triage, NMCN Code, Informed Consent.

### O — Promotion / carryover engine (~18-22h, big feature, multi-session)
Auto-suggest with admin review (Model 2). Logic locked: pass all → promote; 1-2 fails → promote with carryover; 3+ fails → repeat. Needs schema additions: academic_sessions table, level_history, outstanding_courses, user.status enum (ACTIVE/GRADUATED/WITHDRAWN/SUSPENDED). Must talk to College to confirm exact policy before building.

### P — Tuition fee payment + exam slip (~12-16h, multi-session)
Threshold: 100% payment required. Flow: student uploads receipt → admin verifies → on approval, exam slip becomes downloadable. Receipts stored in DB grouped per student per session. Decisions still needed:
- Acceptable receipt formats (PDF, image, both?)
- Per-semester vs per-session billing
- Whether bursary office gets its own role
- Exam slip contents (photo, matric, course list, QR/signature)
- Whether CampusOS becomes the payment portal itself or stays a record-keeper

### Q — RAG for AI Chat (multi-session, blocked on OpenAI budget)
Ground AI tutor answers in uploaded PDFs (textbooks, FMoH guidelines). Plan already drafted (OpenAI text-embedding-3-small, pgvector). Costs ~₦5,000 minimum credit for OpenAI.

### R — Simulation (clinical scenarios) (~multi-week project)
Text-based clinical case engine. Possibly 3D ambition later — out of scope for foreseeable future.

## Standing issues / cosmetic

- `stats.revenue.totalToday` vs backend `totalTodayKobo` field mismatch — revenue cards show ₦0 to super admin
- Stray duplicate `<div>` in Admin.tsx People section — works but brittle
- Mobile bottom nav still missing some items; review when needed

## Operating discipline (hard-earned)

1. ONE feature per session. Period.
2. Commit between every step within a feature.
3. Browser-test before commit.
4. Push to GitHub at the end so the safe state is shared.
5. Never combine auth/routing changes with feature changes — the trap that broke us in Round 6 and the email-redirect attempts.
6. Stop on a win. Do not "just one more thing" after midnight.
7. Test keys / sandbox until the full flow is proven. Live keys / live data last.
