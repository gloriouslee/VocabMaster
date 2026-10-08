# VocabMaster

Vocabulary study app built with Next.js and Supabase.

## Database setup

The schema is managed with Supabase CLI migrations for project
`pzpjzpigohjpuuvqvmqi`. It creates user-owned folders,
vocabulary, review history, quiz results, quiz folder links, and mistake logs.
Every exposed table has row-level security enabled. User-owned foreign keys also
prevent records from linking to another user's folders or vocabulary.

1. Install Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. Start a local Supabase stack and apply the migration with `supabase start`.
   The CLI applies `supabase/migrations` automatically on first start; for an
   already-running local stack, run `supabase migration up`.
4. To apply to a hosted project, link the correct project with `supabase link`
   and run `supabase db push` after reviewing the migration.

The database migrations are applied to the hosted project. They include
`record_vocabulary_review`, which updates the spaced repetition schedule and
inserts its review log in one transaction. Generated database types are kept in
`src/types/database.ts`.

## Authentication and data

The sign-in page uses Supabase Auth (email/password and Google OAuth). Vocabulary,
folders, reviews, quiz results, and mistakes are read from and written to the
authenticated user's Supabase rows. Study activity and streaks are calculated
from persisted review and quiz history; accounts with no history start at zero.

Copy `.env.example` to `.env.local` if needed. The publishable key belongs in the
browser; never use a `service_role` key in this app. Existing browser-only data
is not automatically imported into an account.
