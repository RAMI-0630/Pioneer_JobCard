# Pioneer Job Cards

A digital job card system built for a tyre and auto workshop. The idea came from a simple problem — the workshop was running on paper job cards, and finding old records meant digging through a pile of forms. This app replaces that with a searchable digital system that works on any device, including offline.

---

## What it does

- Create job cards for workshop visits — customer info, vehicle details, services performed, technician, time in/out
- Search old records by job card number, plate number, customer name, mobile, or date
- Edit and close job cards when work is done
- Works offline — create and edit job cards even when there's no internet, and everything syncs automatically when you reconnect
- Installable on Android and iPhone as a PWA — runs like a native app from your home screen

---

## Tech stack

- **React 19** + **Vite** — frontend
- **Supabase** — PostgreSQL database, auth, and API (no custom backend)
- **vite-plugin-pwa** + **Workbox** — service worker and asset caching
- **idb** — IndexedDB wrapper for the offline queue
- **React Router v7** — routing

---

## Getting started

You'll need a Supabase project set up first. The SQL schema is in `supabase_setup.sql`.

**1. Clone the repo**

```bash
git clone https://github.com/your-username/pioneer-job-cards.git
cd pioneer-job-cards
```

**2. Set up environment variables**

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**3. Install dependencies**

```bash
npm install
```

**4. Run the dev server**

```bash
npm run dev
```

**5. Run the tests**

```bash
npm test
```

---

## Offline support

When there's no internet connection, the app keeps working. Job cards created or edited offline get saved to IndexedDB and queued for sync. When connectivity comes back, the sync runs automatically in the background. A status bar at the top of the app shows you what's happening — whether you're offline, syncing, or all caught up.

The service worker caches the app shell so the whole UI loads from cache with no network at all.

---

## Installing on your phone

**Android (Chrome):** Open the app, tap the three-dot menu, tap "Add to Home screen".

**iPhone (Safari):** Open the app in Safari, tap the Share button, tap "Add to Home Screen".

Once installed it runs in standalone mode — no browser bar, just the app.

---

## Project structure

```
src/
  components/
    layout/       # AppLayout, topbar
    ui/           # Reusable components (inputs, spinner, badges, SyncStatusBar)
  context/
    AuthContext   # Supabase auth state
    OfflineContext # Online/offline state, sync controls
  lib/
    queries.js    # All Supabase queries
    offlineQueue.js # IndexedDB queue for offline ops
    syncEngine.js # Replays queued ops against Supabase on reconnect
  pages/          # One file per route
  test/           # Vitest + fast-check property tests
```

---

## Database

The schema lives in `supabase_setup.sql`. Tables:

- `customers` — name and mobile
- `vehicles` — plate, make, model, year, tyre sizes
- `job_cards` — the main record, linked to customer and vehicle
- `job_card_service_lines` — services performed on a job card
- `service_catalog` — the fixed list of workshop services (balancing, tyre repair, mounting, etc.)
- `balancing_details`, `tyre_repair_details`, `mounting_details` — detail rows per service line

Row Level Security is enabled — only authenticated users can read or write workshop data.

---

## License

MIT
