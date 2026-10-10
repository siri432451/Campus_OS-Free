-- Round 5: AI Conversations, Flashcard Decks/Cards/Reviews
-- Migration: 20240701000000_round5_chat_announcements_flashcards

-- ── Ensure AnnouncementTarget has STUDENTS/LECTURERS/ADMINS ──
-- These values were in Round 4; ADD VALUE IF NOT EXISTS is safe
ALTER TYPE "AnnouncementTarget" ADD VALUE IF NOT EXISTS 'STUDENTS';
ALTER TYPE "AnnouncementTarget" ADD VALUE IF NOT EXISTS 'LECTURERS';
ALTER TYPE "AnnouncementTarget" ADD VALUE IF NOT EXISTS 'ADMINS';

-- Add isPinned column if missing from announcements
ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE;

-- Add authorId (createdById alias) if needed — column already exists as created_by_id
-- No action needed: announcements table already has created_by_id from Round 1

-- ── TutorMode enum (for AI conversations) ────────────────────
CREATE TYPE "TutorMode" AS ENUM (
  'ANATOMY_PHYSIOLOGY',
  'PHARMACOLOGY',
  'CLINICAL_REASONING',
  'MATERNAL_NEWBORN',
  'MICROBIOLOGY_IPC',
  'COMMUNITY_HEALTH',
  'MIDWIFERY',
  'GENERAL_NURSING'
);

-- ── MessageRole enum ──────────────────────────────────────────
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- ── conversations table ───────────────────────────────────────
CREATE TABLE "conversations" (
  "id"          TEXT         NOT NULL,
  "user_id"     TEXT         NOT NULL,
  "mode"        "TutorMode"  NOT NULL,
  "title"       TEXT         NOT NULL DEFAULT 'New Conversation',
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- ── chat_messages table ───────────────────────────────────────
CREATE TABLE "chat_messages" (
  "id"              TEXT          NOT NULL,
  "conversation_id" TEXT          NOT NULL,
  "role"            "MessageRole" NOT NULL,
  "content"         TEXT          NOT NULL,
  "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
);
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- ── Flashcard Deck table ──────────────────────────────────────
CREATE TABLE "flashcard_decks_v2" (
  "id"           TEXT             NOT NULL,
  "title"        TEXT             NOT NULL,
  "description"  TEXT,
  "category"     "LibraryCategory" NOT NULL DEFAULT 'OTHER',
  "level"        "Level"          NOT NULL DEFAULT 'ND1',
  "is_public"    BOOLEAN          NOT NULL DEFAULT TRUE,
  "created_by_id" TEXT            NOT NULL,
  "created_at"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "flashcard_decks_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flashcard_decks_v2_created_by_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "flashcard_decks_v2_created_by_idx" ON "flashcard_decks_v2"("created_by_id");

-- ── Flashcard Card table ──────────────────────────────────────
CREATE TABLE "flashcard_cards" (
  "id"         TEXT        NOT NULL,
  "deck_id"    TEXT        NOT NULL,
  "front"      TEXT        NOT NULL,
  "back"       TEXT        NOT NULL,
  "sort_order" INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "flashcard_cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flashcard_cards_deck_fkey"
    FOREIGN KEY ("deck_id") REFERENCES "flashcard_decks_v2"("id") ON DELETE CASCADE
);
CREATE INDEX "flashcard_cards_deck_idx" ON "flashcard_cards"("deck_id");

-- ── Flashcard Review table (SM-2 spaced repetition) ──────────
CREATE TABLE "flashcard_reviews" (
  "id"           TEXT        NOT NULL,
  "user_id"      TEXT        NOT NULL,
  "card_id"      TEXT        NOT NULL,
  "ease_factor"  FLOAT       NOT NULL DEFAULT 2.5,
  "interval"     INTEGER     NOT NULL DEFAULT 1,
  "repetitions"  INTEGER     NOT NULL DEFAULT 0,
  "next_review"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_review"  TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "flashcard_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flashcard_reviews_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "flashcard_reviews_card_fkey"
    FOREIGN KEY ("card_id") REFERENCES "flashcard_cards"("id") ON DELETE CASCADE,
  CONSTRAINT "flashcard_reviews_user_card_unique"
    UNIQUE ("user_id", "card_id")
);
CREATE INDEX "flashcard_reviews_user_idx" ON "flashcard_reviews"("user_id");
CREATE INDEX "flashcard_reviews_card_idx" ON "flashcard_reviews"("card_id");
CREATE INDEX "flashcard_reviews_next_review_idx" ON "flashcard_reviews"("next_review");
