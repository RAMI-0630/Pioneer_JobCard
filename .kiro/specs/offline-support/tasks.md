# Implementation Tasks

## Task List

- [x] 1. Install dependencies and configure PWA plugin
  - [x] 1.1 Install `vite-plugin-pwa` and `idb` packages
  - [x] 1.2 Update `vite.config.js` to register `vite-plugin-pwa` with Workbox `generateSW` strategy, CacheFirst for app-shell assets, and NetworkFirst (3 s timeout) for Supabase GET requests
  - [x] 1.3 Add `public/manifest.webmanifest` with app name, icons, and `display: standalone`
  - [x] 1.4 Verify `vite build` produces a service worker file in `dist/`

- [x] 2. Implement `src/lib/offlineQueue.js`
  - [x] 2.1 Open (or upgrade) the `pioneer_offline` IndexedDB database using `idb`, creating the `pending_ops` object store with auto-increment `id` and a `localId` index
  - [x] 2.2 Implement `enqueue(type, localId, payload)` — inserts a Queue_Item with `attempts: 0` and `createdAt: Date.now()`
  - [x] 2.3 Implement `getAll()` — returns all items from `pending_ops`
  - [x] 2.4 Implement `getByLocalId(localId)` — returns the first item matching the `localId` index, or `undefined`
  - [x] 2.5 Implement `updateItem(id, partialPayload)` — merges `partialPayload` into the existing item
  - [x] 2.6 Implement `remove(id)` — deletes the item with the given key
  - [x] 2.7 Implement `clear()` — deletes all items from the store
  - [x] 2.8 Implement `getPendingCount()` — returns the count of items in the store
  - [x] 2.9 Wrap `openDB` in a try/catch; on failure export no-op stubs and set a module-level `isAvailable` flag to `false`

- [x] 3. Implement `src/lib/syncEngine.js`
  - [x] 3.1 Add a module-level `syncing` boolean flag and export `isSyncing()` returning its value
  - [x] 3.2 Implement `replayCreate(payload)` — mirrors `CreateJobCardPage.handleSubmit`: customer upsert → vehicle upsert → job card insert → service lines replace using existing `queries.js` functions
  - [x] 3.3 Implement `replayEdit(localId, payload)` — mirrors `EditJobCardPage.handleSubmit`: customer update → vehicle update → job card update → service lines replace
  - [x] 3.4 Implement `syncPendingOps(onProgress)` — guards against concurrent runs, iterates queue items, calls `replayCreate`/`replayEdit`, removes successful items, increments `attempts` on failure, skips items with `attempts >= 3`, calls `onProgress` after each item, resets `syncing` flag on completion

- [x] 4. Implement `src/context/OfflineContext.jsx`
  - [x] 4.1 Create `OfflineProvider` component that initialises `isOnline` from `navigator.onLine` at mount
  - [x] 4.2 Register `window` `online` and `offline` event listeners to update `isOnline` state
  - [x] 4.3 Register `document` `visibilitychange` listener to trigger sync when page becomes visible while online with pending items
  - [x] 4.4 Implement `syncNow()` — calls `syncEngine.syncPendingOps` with a progress callback that updates `isSyncing`, `pendingCount`, and `lastSyncError` state
  - [x] 4.5 Auto-call `syncNow()` when `isOnline` transitions to `true` and `pendingCount > 0`
  - [x] 4.6 Implement `refreshPendingCount()` — reads `offlineQueue.getPendingCount()` and updates state
  - [x] 4.7 Export `useOffline()` hook that throws if used outside `<OfflineProvider>`
  - [x] 4.8 Show a one-time warning toast when `offlineQueue.isAvailable` is `false` (IndexedDB unavailable)

- [x] 5. Implement `src/components/ui/SyncStatusBar.jsx`
  - [x] 5.1 Create the component that reads `{ isOnline, pendingCount, isSyncing, lastSyncError, syncNow }` from `useOffline()`
  - [x] 5.2 Return `null` when `isOnline && pendingCount === 0 && !lastSyncError`
  - [x] 5.3 Render offline state (red indicator + message) when `!isOnline`
  - [x] 5.4 Render syncing state (yellow indicator + spinner + count) when `isOnline && isSyncing`
  - [x] 5.5 Render pending state (yellow indicator + count + "Sync now" button) when `isOnline && !isSyncing && pendingCount > 0`
  - [x] 5.6 Render error state (red indicator + "Sync failed" + "Retry" button calling `syncNow`) when `isOnline && lastSyncError`
  - [x] 5.7 Render "All changes synced" (green indicator) after a successful sync and auto-hide after 3 seconds
  - [x] 5.8 Add `role="status"` to the root element for screen-reader accessibility
  - [x] 5.9 Add CSS classes `sync-bar`, `sync-bar--offline`, `sync-bar--warning`, `sync-bar--success` to `src/index.css`

- [x] 6. Integrate offline support into existing pages and app shell
  - [x] 6.1 Wrap the component tree in `src/main.jsx` with `<OfflineProvider>` inside `<AuthProvider>`
  - [x] 6.2 Render `<SyncStatusBar />` in `src/components/layout/AppLayout.jsx` above the `<Outlet />`
  - [x] 6.3 Update `src/pages/CreateJobCardPage.jsx` — in `handleSubmit`, check `isOnline`; if offline, generate `localId`, call `enqueue`, call `refreshPendingCount`, navigate to `/job-cards`, and return early; leave the online path unchanged
  - [x] 6.4 Update `src/pages/EditJobCardPage.jsx` — in `handleSubmit`, check `isOnline`; if offline and `id` starts with `local-`, call `offlineQueue.updateItem`; if offline and real UUID, call `offlineQueue.enqueue('EDIT', id, payload)`; show toast; leave the online path unchanged
  - [x] 6.5 Update `src/pages/EditJobCardPage.jsx` — in `useEffect`, if `id` starts with `local-`, load the draft from `offlineQueue.getByLocalId(id)` instead of calling `fetchJobCardById`

- [x] 7. Write unit and property-based tests
  - [x] 7.1 Set up `vitest` with `fake-indexeddb` for testing `offlineQueue.js` in isolation
  - [x] 7.2 Write property test: for any valid `type`, `localId`, and `payload`, `enqueue` then `getAll` returns an item with matching `payload`, `attempts: 0`, and correct `localId` (Property 1 — Req 2.2, 2.5, 2.6)
  - [x] 7.3 Write property test: for any sequence of `enqueue` and `remove` calls, `getPendingCount()` equals enqueued minus removed (Property 2 — Req 2.9, 6.6)
  - [x] 7.4 Write property test: for any queue with N items, `remove(id)` leaves N−1 items and the removed item is absent from `getAll()` (Property 3 — Req 2.8)
  - [x] 7.5 Write property test: for any CREATE queue item with `attempts < 3`, after successful `syncPendingOps` the item is absent from the queue (Property 4 — Req 5.2, 5.4)
  - [x] 7.6 Write property test: for any EDIT queue item with `attempts < 3`, after successful `syncPendingOps` the item is absent from the queue (Property 5 — Req 5.3, 5.4)
  - [x] 7.7 Write property test: for any queue where one item fails, `syncPendingOps` increments that item's `attempts` and processes all remaining items (Property 6 — Req 5.5)
  - [x] 7.8 Write property test: for any item with `attempts >= 3`, `syncPendingOps` never calls any `queries.js` function for it (Property 7 — Req 5.6)
  - [x] 7.9 Write property test: after any `syncPendingOps` invocation, `isSyncing` is `false` (Property 8 — Req 5.8)
  - [x] 7.10 Write unit test: `SyncStatusBar` renders `null` when online, no pending, no error (Req 7.1)
  - [x] 7.11 Write unit test: `SyncStatusBar` renders offline message when `isOnline` is `false` (Req 7.2)
  - [x] 7.12 Write unit test: `SyncStatusBar` renders error state with Retry button when `lastSyncError` is set (Req 7.5)
  - [x] 7.13 Write unit test: `useOffline()` throws when called outside `<OfflineProvider>` (Req 6.9)
