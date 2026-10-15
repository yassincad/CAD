# CAD OFPPT — starter project for Vercel

## What is included
- Arabic RTL landing page, rules, registration, login, trainee dashboard.
- Pending approval workflow, private complaints, profile skills/languages, skill proof uploads.
- Admin view for approvals/rejections, ranks A/B/C/D, monthly-star toggle, announcements, complaint status and skill review.
- Supabase database schema and row-level security policies.

## Deploy
1. Create a GitHub repository and upload the contents of this folder.
2. In Supabase → SQL Editor, run `supabase/schema.sql`.
3. In Supabase → Project Settings → API, copy Project URL and the **anon/public** key.
4. In Vercel, import the GitHub repository. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy. In Supabase → Authentication → URL Configuration, add your Vercel deployment URL to Site URL and Redirect URLs.
6. Supabase → Authentication → Providers → Email: configure email confirmation to match your intended process.
7. Create the first account through the site. In Supabase → Authentication → Users, copy its UUID. In SQL Editor run:
   `update public.profiles set role='admin', status='approved' where id='PASTE-UUID-HERE';`
   Only do this for the verified CAD administrator. The profile row must already exist; if email confirmation is enabled, sign in once after confirming.
8. Test with a separate trainee account. Confirm trainee A cannot see trainee B's complaint or profile.

## Important limitations to resolve before public launch
- This is a starter, not a certified institutional system. Have a qualified developer/security reviewer validate all RLS policies and account flows.
- CIN and photos are sensitive personal data. Obtain institutional authorization and appropriate consent, restrict access, define retention/deletion rules, and avoid collecting CIN unless necessary.
- The UI includes a rank and monthly-star control, but does not yet implement a full competition-management/results module, in-app notification inbox, audit log, or a real badge issuing/verification page.
- The code uploads private images but does not yet display them via signed URLs.
- Do not put Supabase `service_role` keys in client code or Vercel `NEXT_PUBLIC_*` variables.
- Supabase Auth login uses email + password. Never use a CIN as a password or generate fake email addresses from CIN.
