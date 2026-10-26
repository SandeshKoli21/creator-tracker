# Creator Tracker — Plan

Small full-stack app: add creators and list them, newest first.

**Stack:** Node.js + Express · plain HTML/JS (served by Express) · Supabase (Postgres) via `supabase-js` · secrets in `.env` (gitignored)

---

## Phase 1 — Database table

Create the `creators` table in the Supabase SQL editor:

| Column       | Type          | Notes                                              |
|--------------|---------------|----------------------------------------------------|
| `id`         | `bigint`      | identity, primary key                              |
| `name`       | `text`        | not null, 1–100 characters                         |
| `platform`   | `text`        | not null, must be `Instagram` or `YouTube`         |
| `followers`  | `bigint`      | not null, must be greater than 0                   |
| `created_at` | `timestamptz` | defaults to `now()`, used for newest-first sorting |

- Add CHECK constraints so the database rejects bad data even if the API misses it.
- Turn on RLS with no public policies. Only the server talks to the DB, using the service role key.

## Phase 2 — Backend API

Setup: `npm init`, then install `express`, `@supabase/supabase-js` and `dotenv`.
`.env` holds `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `PORT`. Add `.env` and `node_modules` to `.gitignore` and commit a `.env.example`.

| Method | Path            | Success                                  | Errors                                       |
|--------|-----------------|------------------------------------------|----------------------------------------------|
| GET    | `/api/creators` | `200` + array, sorted `created_at desc`  | `500` on DB error                            |
| POST   | `/api/creators` | `201` + created row                      | `400` validation error · `500` on DB error   |

Validation on POST, which returns `400` with `{ error: "..." }`:
- `name` is a non-empty string after trimming, at most 100 characters
- `platform` is either `Instagram` or `YouTube`
- `followers` is a positive whole number: an integer greater than 0 and at most `Number.MAX_SAFE_INTEGER`. Reject `"12.5"`, `-3`, `0` and `"abc"`.

Robustness:
- **Startup check:** if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, log a clear message and exit.
- **Broken JSON:** an error-handling middleware returns `400 { error }` instead of Express's default HTML error page.
- **Server errors:** log the real error on the server and send `500 { error: "Something went wrong" }`, so database details stay private.

The app also serves `public/` as static files and parses JSON request bodies with `express.json()`.

**Manual tests** (`requests.http` or curl): one valid creator, then a blank name, `followers` of `0`, `-5`, `12.5` and `"abc"`, a bad platform and broken JSON. Each invalid request should return `400`.

## Phase 3 — Frontend page

`public/index.html` with plain JS:
- A form with a name input, a platform select (Instagram/YouTube), a followers number input and a submit button
- On submit, `POST /api/creators`. On success, clear the form and reload the list. On `400`, show the server's error message.
- On page load, `GET /api/creators` and render the creators as a list or table, newest first
- Disable the submit button while a request is in progress, which also prevents double submits
- Show a loading message while the list loads and "No creators yet" when it is empty
- Display followers with `toLocaleString()`, so 1250000 shows as `1,250,000`
- Insert user text with `textContent`, not `innerHTML`, to avoid XSS

## Phase 4 — Deploy

- Push to GitHub and confirm `.env` is not committed
- Deploy to Render or Railway as a Node web service, with start command `node server.js`
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables on the host
- The app reads `process.env.PORT`
- Smoke test: add a creator, check it appears at the top, then submit invalid input and check the error shows

---

## Changes

_(Record any changes to the plan here as you build.)_

- **2026-10-26:** Hardened the plan before building:
  - `followers` is now `bigint`, and `name` is limited to 100 characters, checked in both the DB and the API
  - Added a startup check for env vars, a `400` reply for broken JSON and generic `500` messages
  - Added a list of manual test requests
  - Frontend: submit button disabled while saving, loading and empty states, formatted follower counts
- **2026-10-26 (Phase 2):** Small additions while building the backend:
  - `followers` also accepts a string of digits (e.g. `"500"`), which is still rejected if it's `"12.5"` or `"abc"`
  - A request body that isn't a JSON object returns `400`
  - Unknown `/api/*` routes return `404 { error }`
  - Added `npm start` and `npm run dev` scripts
