# FestAtlas Web

The FestAtlas app as a website. Static site (Vite + Preact), reads and writes your
Supabase database directly with the same tables, views and RPCs as the iOS app, so it
shows the same data and uses the same accounts. Hosts free on GitHub Pages.

## What's in v1

| Area | What it does |
|---|---|
| Home | Coming-up festivals, hot artists, latest updates |
| Festivals | Search, filter, grid and month calendar |
| Festival page | Lineup (grid/list), schedule (by stage / by time, weekends, days, updated and cancelled sets), aftershows, poster, insights, edition picker, tracking and "I'm going" |
| Artist page | Photo, links, upcoming and past sets with real times, show dates, history, same-bill artists, member/side-project links |
| Updates | News feed with search, category filter, detail view |
| Compare | Shared artists between two festivals by year |
| My Atlas | Overview, tracked artists, going and tracked festivals, seen sets (tap ✓ on any schedule or log a past festival), Festival DNA |
| Account | Password, email link, sign-up, password reset, profile editing |

Not in v1: friends and activity feed, mock lineup, plans/picks export, set ratings,
comments, notifications, 30-second Deezer previews, in-app account deletion (see below).

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in your Supabase URL + anon key
npm run dev
```

Use the same values as `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the iOS build settings.

## Deploy free on GitHub Pages

1. Create a GitHub repo (public repos get free Pages) and push this folder to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → Variables**: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Push (or run the workflow manually). The site appears at
   `https://<user>.github.io/<repo>/`.
5. Supabase **Authentication → URL Configuration**: add that exact URL
   (with the trailing slash) to **Redirect URLs**, and set it as the **Site URL** if you
   want email links to land on the website. Add `http://localhost:5173/` for local dev.
   Without this, magic links and password-reset emails won't return to the site.

> Note: email links use one Site URL per project. If the iOS app relies on the Site URL
> or a `festatlas://` redirect for its own emails, add the web URL to the redirect allow
> list rather than replacing what the app uses.

## Before you make it public: lock down Supabase

The anon key ends up in the website's JavaScript. That's normal and it's the same key the
iOS app ships with, but a website makes it trivial to find, so the database must be safe
with that key in anyone's hands. Your own launch-readiness review lists these as still
unverified; run `DDL_10262026/catalog_check.sql` and confirm:

- Row Level Security is on for every table holding user data (profiles, tracked artists
  and festivals, seen sets, plans, ratings, comments, follows, blocks, device tokens).
- `exec_sql(text)` is dropped or has EXECUTE revoked from `anon` and `authenticated`.
  This one matters most: left callable, it lets anyone run SQL.
- The `fa_*` helpers and the maintenance functions (`refresh_festival_views`,
  `promote_*`, `refresh_genre_tag_map`) are not executable by `anon`.
- The reference data the site reads is selectable by `anon` (festival_information,
  festival_dates, festival_logos, festival_news, festival_posters, artist_metadata,
  artist_name_normalization, the lineup/schedule views, `hot_artists_mv`).

## Free-tier limits to keep an eye on

Check the current numbers on each provider's pricing page, because they change.

- **GitHub Pages:** soft limits on site size and monthly bandwidth; static files only.
- **Supabase free plan:** projects can be paused after a period of inactivity, and
  database size, egress and monthly active users are capped. A paused project makes the
  site (and the iOS app) show errors until you restore it.

## Third-party terms

Artist images come from Deezer and your notes say Deezer's API terms limit use to
non-commercial purposes. The web app doesn't change that: if you ever add ads or
subscriptions, the licensing review applies to the website too. The footer carries the
Deezer credit.

## Account deletion

Deletion runs through the `delete-account` edge function in the iOS app. The site points
people to your support email instead of calling the function. If you want a delete button
on the web, it needs that function's URL and a confirmed fix for the FK issues flagged in
the 10/26 review.

## Code map

```
src/api.js        every Supabase call (tables, views, RPCs) in one place
src/userdata.jsx  tracked artists/festivals, seen sets, going: optimistic updates
src/auth.jsx      sign-in, sign-up, magic link, reset (PKCE)
src/pages/*       one file per screen
```

Routing is hash-based (`#/festival/Coachella`), so GitHub Pages needs no rewrite rules.
