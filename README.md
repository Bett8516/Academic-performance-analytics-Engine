# Classmark — Academic Performance Analytics

A responsive instructor gradebook using Supabase Auth and Postgres. Each instructor has an account and can only read or change their own student marks.

## Connect Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`schema.sql`](schema.sql). It creates `student_marks`, its constraints, grants, and row-level security policies.
3. Copy the project URL and the **publishable** key (or legacy `anon` key) from Project Settings → API into [`config.js`](config.js).
4. In Authentication → URL Configuration, set the site URL to the address where you serve this app. Add that address to the redirect URL allow list. If email confirmation is enabled, new instructors must confirm their email before signing in.
5. Serve this folder over HTTP (ES modules do not run from `file://`). For example, from this directory run `python -m http.server 8000`, then open `http://localhost:8000`.

The browser key is designed to be public. Never put a Supabase `service_role` key in this app. Database access is limited by row-level security, and the app only exposes sign-up, sign-in, password reset, sign-out, and per-account gradebook records.

## Included

- Email/password registration with full name, password confirmation, and email confirmation messaging.
- Sign-in, password reset email and password update, persisted Supabase session, and sign-out.
- Protected gradebook view with create, edit (select a student's name), search, and delete.
- Class average, pass rate, subject averages, and a simple performance insight.
- Database-side score/name constraints and separate read, insert, update, and delete RLS policies.

The password reset email returns to the configured site URL. The app handles Supabase's `PASSWORD_RECOVERY` event and lets the user set a new password there.
