# Cabin Inventory

A shared inventory for the vacation home in Tofte, MN. Keon and Claire can browse
what's at the cabin by location, category, or person; snap a photo of laid-out items
and have Claude identify and catalog them; track quantities and expiry; and build
packing checklists per trip.

## Stack

- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase: Postgres + Storage (private `photos` bucket) + Auth
- Anthropic API (`claude-opus-4-8`) for multi-item photo recognition

## One-time setup

1. **Supabase project** (https://supabase.com/dashboard):
   - Run `supabase/migrations/0001_init.sql` in the SQL editor (creates tables,
     RLS policies, the `photos` storage bucket, and seed data — categories, people,
     and the house's rooms). Or link the project and run `supabase db push`.
   - Auth → Sign In / Up: enable **Email** provider, and turn **off**
     "Allow new users to sign up".
   - Auth → Users: click "Add user" twice — create accounts for Keon and Claire
     with passwords (or send invites).
2. **Anthropic API key**: create one at https://console.anthropic.com (Billing →
   load a small credit balance; photo analysis costs ~5¢ per photo).
3. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (Supabase dashboard → Settings → API)
   - `ANTHROPIC_API_KEY`
4. **Deploy**: import the repo in Vercel and set the same three env vars.

## Local development

```bash
npm install
npm run dev
```

## How it works

- **Inventory** (`/`): search, filter by location/category/person, flag
  expiring/low-stock items, group by any dimension.
- **Snap** (`/snap`): lay items out → photo → the photo is downscaled on-device,
  uploaded to Supabase Storage, and sent to `/api/analyze-photo`, which calls
  Claude with a structured-output schema. You review/edit the detected items,
  then confirm to add them all (linked to the photo).
- **Trips** (`/trips`): per-trip packing checklist ("pack" / "bring home") with a
  searchable "already at the cabin" list. Completing a trip adds checked pack
  items to inventory and decrements/removes checked bring-home items.
- **Settings**: manage the location tree (floor → room → area), categories, people.

Auth is intentionally closed: signups are disabled in Supabase, the two household
accounts are created by hand, and row-level security grants any authenticated
user full access (the household *is* the auth boundary).
