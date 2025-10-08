# Blog Integration - Runaro ↔ Runaro Stories

## Status Snapshot (9 Jan 2025)

- ✅ Supabase schema for blog posts (`blog_posts` table, helper functions, storage bucket, `is_blog_admin` flag).
- ✅ Client utilities for CRUD/upload (`src/lib/blogApi.ts`) and admin detection hook (`useBlogAdmin`).
- ✅ Landing page preview section + `/blog` and `/blog/:slug` public routes.
- ✅ Admin dashboard/editor routes (`/admin/blog`, `/admin/blog/new`, `/admin/blog/:id`) using shared auth.
- ⚠️ `npm run lint` still fails because of legacy `any`/parser warnings elsewhere in repo (pre-existing).

## What’s Live in the Code

| Area | Path |
| --- | --- |
| Schema migration | `supabase/migrations/20260101000012_create_blog_tables.sql` |
| Blog API helpers | `src/lib/blogApi.ts` |
| Blog preview block | `src/components/blog/BlogPreviewSection.tsx` |
| Landing update | `src/pages/Index.tsx` |
| Public routes | `src/pages/BlogIndex.tsx`, `src/pages/BlogPostPage.tsx` |
| Admin routes | `src/pages/BlogAdminDashboard.tsx`, `src/pages/BlogEditorPage.tsx` |
| Admin hook | `src/hooks/useBlogAdmin.ts` |
| Routing | `src/App.tsx` |
| UI card | `src/components/blog/BlogPostCard.tsx` |

## Deployment Checklist

1. `npm install` (already run locally to add `react-markdown` + `slugify`).
2. `npm run db:push` – apply the new blog migration + storage policies to Supabase.
3. Promote at least one user: `update public.profiles set is_blog_admin = true where user_id = '<auth-uuid>'`.
4. Seed/import posts (optional now, mandatory before launch).
5. Fix legacy lint errors outside the blog files or relax the rule set so CI succeeds (`npm run lint` currently fails).

## Follow-Up Work

- **Content migration:** port Cobble Run Stories data (markdown, images) into the new tables and storage bucket.
- **Editor polish:** add markdown preview or rich-text handling if desired; validate slug uniqueness before save.
- **Realtime/ISR:** decide whether homepage/blog list should re-fetch on post publish; currently manual reload.
- **Access control UX:** consider hiding admin routes behind a nav link only when `is_blog_admin` is true.
- **Analytics/SEO:** add OpenGraph meta, sitemap updates, etc. after content is populated.
- **Testing:** add Vitest coverage for `blogApi` + Cypress smoke for admin publish flow once lint debt addressed.

## Useful Prompts for Claude

- “Run `npm run db:push` and confirm blog posts table exists.”
- “Set `is_blog_admin` to true for the current user and create a sample post in `/admin/blog/new`.”
- “Resolve the TypeScript `any` lint issues flagged by `npm run lint`.”
- “Import Cobble Run Stories markdown files into `blog_posts` with cover uploads.”

---
_Drop this file once integration is stable and documented elsewhere._
