# Round 5 — Changes & Notes

## Summary

Round 5 adds four substantial features:
1. Splash + Login redesign — cohesive full-screen layout, no phone-frame on Splash/Login
2. AI Chat with 8 nursing tutor modes and persistent conversation history
3. Announcements — full CRUD with pagination, pinning, lecturer/admin posting
4. Flashcards with SM-2 spaced repetition — decks, cards, study sessions

---

## New / Changed Files

### Backend

| Path | Status | Description |
|---|---|---|
| `backend/prisma/schema.prisma` | **Updated** | New models: Conversation, ChatMessage, FlashcardDeckV2, FlashcardCard, FlashcardReview. New enums: TutorMode, MessageRole. |
| `backend/prisma/migrations/20240701000000_round5_chat_announcements_flashcards/migration.sql` | **New** | Creates all new tables; ensures AnnouncementTarget enum has STUDENTS/LECTURERS/ADMINS |
| `backend/src/routes/ai.ts` | **Updated** | New endpoints: POST /chat (mode-based), GET/POST/GET/:id/DELETE/:id /conversations. Legacy /chat-legacy, /history, /delete kept. |
| `backend/src/routes/announcements.ts` | **Updated** | Rewrote with pagination, PATCH, lecturer access, proper owner/admin auth |
| `backend/src/routes/flashcards.ts` | **New** | Full CRUD for decks + cards, SM-2 review endpoint, study session endpoint |
| `backend/src/lib/tutorPrompts.ts` | **New** | System prompts for 8 tutor modes — Nigeria-aware, Socratic, subject-scoped |
| `backend/package.json` | **Updated** | No new deps needed — @anthropic-ai/sdk already present |

### Frontend

| Path | Status | Description |
|---|---|---|
| `frontend/src/App.tsx` | **Updated** | AppShell redesigned for new Splash/Login (no fixed 844px for auth screens). Added flashcard sub-routes. |
| `frontend/src/pages/Splash.tsx` | **Redesigned** | Full-screen gradient, 3 slides with animation, dots, CTA on last slide |
| `frontend/src/pages/Login.tsx` | **Redesigned** | Two-panel on desktop (brand left, form right). Full-screen on mobile. No phone-frame cutoff. |
| `frontend/src/pages/AI.tsx` | **New** | Full chat with 8 tutor mode cards, conversation history sidebar (desktop) / list (mobile), markdown rendering, typing indicator |
| `frontend/src/pages/Announcements.tsx` | **New** | Card list with expand, pinned section, form modal for posting/editing, delete confirm |
| `frontend/src/pages/Flashcards.tsx` | **New** | Deck browser with filter (All/Mine/Due Today), search, due count badges |
| `frontend/src/pages/FlashcardsCreate.tsx` | **New** | Create deck form — title, description, level chips, category dropdown, public toggle |
| `frontend/src/pages/FlashcardsEdit.tsx` | **New** | Deck editor — add cards, edit/delete cards, reorder with arrows, bulk import (TSV/CSV) |
| `frontend/src/pages/FlashcardsStudy.tsx` | **New** | Study session — flip card, 4 rating buttons (Again/Hard/Good/Easy), predicted next review, progress bar, end-of-session stats |
| `frontend/src/lib/tutorModes.ts` | **New** | Frontend constants for 8 tutor modes with icons, labels, descriptions |
| `frontend/package.json` | **Updated** | Added react-markdown, remark-gfm |

### Untouched (as instructed)
- All Round 4 library code (routes/library, services/mediaService, pages/Library, pages/LibraryUpload, all library components)
- AuthContext.tsx, api/client.ts, ecosystem.config.js, nginx config, .env files
- Pages: Dashboard, Results, DigitalID, PrintWallet, Simulation
- Components: IDCard, BookCard, GradeBadge, Skeleton, LibraryCard, VideoModal, EditModal, Toast

---

## New Dependencies

### Backend npm
None new — `@anthropic-ai/sdk` was already installed in Round 4.

### Frontend npm
```
react-markdown   ^9.0.1   — Markdown rendering in AI chat + flashcard fronts/backs
remark-gfm       ^4.0.0   — GitHub-Flavored Markdown (tables, strikethrough, etc.)
```

### System
None new beyond what Round 4 required (ffmpeg, poppler-utils).

---

## Database Migration Preview

Migration `20240701000000_round5_chat_announcements_flashcards` creates:

1. `TutorMode` enum (8 values)
2. `MessageRole` enum (USER, ASSISTANT)
3. `conversations` table — userId, mode, title, timestamps
4. `chat_messages` table — conversationId, role, content, createdAt
5. `flashcard_decks_v2` table — title, description, category, level, isPublic, createdById
6. `flashcard_cards` table — deckId, front, back, sortOrder
7. `flashcard_reviews` table — userId, cardId, SM-2 state (easeFactor, interval, repetitions, nextReview), unique(userId, cardId)
8. Ensures AnnouncementTarget enum has STUDENTS, LECTURERS, ADMINS (ADD VALUE IF NOT EXISTS)
9. Ensures announcements.is_pinned column exists

All existing data is preserved. The old flashcard_decks and flashcards tables are untouched.

---

## New API Endpoints

### AI Chat
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/ai/chat | All | Mode-based chat with Anthropic, optionally persists to conversation |
| GET | /api/ai/conversations | All | List user's conversations |
| POST | /api/ai/conversations | All | Create new conversation |
| GET | /api/ai/conversations/:id | Owner | Fetch conversation with messages |
| DELETE | /api/ai/conversations/:id | Owner | Delete conversation |

### Announcements
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/announcements | All | Paginated list filtered by user's role/level |
| POST | /api/announcements | Lecturer+ | Create announcement |
| PATCH | /api/announcements/:id | Owner/Admin | Edit announcement |
| DELETE | /api/announcements/:id | Owner/Admin | Delete announcement |

### Flashcards
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/decks | All | List public + own decks with due counts |
| POST | /api/decks | All | Create deck |
| GET | /api/decks/:id | All (public) | Deck with cards |
| PATCH | /api/decks/:id | Owner/Admin | Edit deck metadata |
| DELETE | /api/decks/:id | Owner/Admin | Delete deck + cards |
| POST | /api/decks/:id/cards | Owner | Add card |
| POST | /api/decks/:id/cards/bulk | Owner | Bulk import (TSV/CSV) |
| PATCH | /api/cards/:id | Owner | Edit card |
| DELETE | /api/cards/:id | Owner | Delete card |
| GET | /api/decks/:id/study | All | Cards due today with SM-2 predictions |
| POST | /api/cards/:id/review | All | Submit SM-2 review quality (0-5) |

---

## Backend index.ts Changes Needed

Add these route registrations to `backend/src/index.ts` (after existing routes):

```typescript
import flashcardRoutes from './routes/flashcards'
// ...
app.use('/api/decks', flashcardRoutes)
app.use('/api/cards', flashcardRoutes)
```

The flashcards route handles both /api/decks/* and /api/cards/* paths.
Split them in index.ts like this:

```typescript
import flashcardDeckRoutes from './routes/flashcards'
app.use('/api', flashcardDeckRoutes)
```

Since the route file uses `/decks/...` and `/cards/...` as its internal paths,
mounting on `/api` will expose `/api/decks/...` and `/api/cards/...` correctly.

---

## Deploy Steps (exact order)

```
1. git pull

2. cd backend
   npm install

3. cd ../frontend
   npm install

4. cd ..
   npm run build

5. cd backend
   npx prisma generate

6. cd backend
   npx prisma migrate deploy

7. cd ..
   pm2 restart campusos-api

8. Hard-refresh browser (Ctrl+Shift+R), test login, AI chat, announcements, flashcards
```

Note: Step 6 runs the Round 5 migration which adds new tables only — no data migration,
no enum renames. Existing data is safe.

---

## Splash + Login Redesign Notes

**Before:** Both Splash and Login were rendered inside a fixed 844px phone-frame
card, causing content cutoff on Login (form taller than frame) and awkward
scrolling on small phones.

**After:**
- Splash: Full-screen gradient background on all viewports. No phone frame.
  Three auto-advancing slides with progress dots and "Get Started" CTA on last slide.
- Login: Full-screen on mobile (content scrolls naturally). On desktop (lg+),
  two-panel layout — brand panel left, elevated white form card right.
  AppShell no longer wraps auth screens in the phone frame.

**AppShell change:** The `noShell` branch now renders:
- Mobile: `min-h-screen` full-screen (children fill viewport)
- Desktop: Dark background with a `max-w-lg rounded-3xl` card (height auto, not 844px)

This fixes both reported bugs without affecting authenticated page layouts.
