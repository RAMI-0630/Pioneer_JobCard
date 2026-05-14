# Requirements Document

## Introduction

This feature adds offline capabilities to the Pioneer Job Cards React + Vite + Supabase application used by workshop technicians. Technicians must be able to open the app, create new job cards, and edit unsynced job cards even when the workshop has no internet connectivity. Changes made offline are stored locally in IndexedDB and automatically synchronised to Supabase when connectivity is restored. A persistent sync status banner keeps technicians informed of their connectivity state and pending record count at all times.

## Glossary

- **App**: The Pioneer Job Cards React + Vite single-page application.
- **Service_Worker**: The Workbox-generated service worker registered by `vite-plugin-pwa` that caches static assets.
- **OfflineQueue**: The `offlineQueue.js` module that reads and writes pending operations to IndexedDB.
- **IndexedDB**: The browser's built-in structured storage database used to persist the offline queue across page reloads.
- **SyncEngine**: The `syncEngine.js` module that replays queued operations against Supabase when connectivity is available.
- **OfflineContext**: The React context (`OfflineContext.jsx`) that exposes connectivity state, pending count, and sync controls to the component tree.
- **SyncStatusBar**: The `SyncStatusBar.jsx` UI component that displays connectivity and sync state to the technician.
- **Queue_Item**: A single pending operation stored in IndexedDB with shape `{ id, localId, type, payload, createdAt, attempts }`.
- **localId**: A string identifier for a Queue_Item; prefixed `local-<uuid>` for CREATE operations and a Supabase UUID for EDIT operations.
- **Technician**: The end-user of the application — a workshop technician who creates and edits job cards.
- **Supabase**: The hosted PostgreSQL backend accessed via the Supabase JavaScript client.

---

## Requirements

### Requirement 1: PWA Asset Caching

**User Story:** As a technician, I want the app to open and display its interface without an internet connection, so that I can start working immediately even when the workshop network is down.

#### Acceptance Criteria

1. THE Service_Worker SHALL cache all static app-shell assets (HTML, JavaScript bundles, CSS, fonts, and images) using a CacheFirst strategy during the Vite production build.
2. WHEN the App is loaded with no network connectivity, THE Service_Worker SHALL serve the cached app shell so the App renders without a network request.
3. WHEN the App makes a GET request to a Supabase REST endpoint, THE Service_Worker SHALL use a NetworkFirst strategy with a 3-second timeout before falling back to a cached response.
4. WHEN the Service_Worker intercepts a Supabase POST, PATCH, or DELETE request, THE Service_Worker SHALL pass the request through to the network without caching it.
5. IF Service_Worker registration fails (e.g., HTTP origin, unsupported browser), THEN THE App SHALL continue to operate in online-only mode without displaying an error to the technician.

---

### Requirement 2: Offline Queue Storage

**User Story:** As a technician, I want my job card data to be saved locally when I'm offline, so that I don't lose work I've entered into the form.

#### Acceptance Criteria

1. THE OfflineQueue SHALL open an IndexedDB database named `pioneer_offline` containing an object store named `pending_ops` with an auto-increment `id` key path and a `localId` index.
2. WHEN `OfflineQueue.enqueue(type, localId, payload)` is called, THE OfflineQueue SHALL insert a new Queue_Item with `attempts` set to `0` and `createdAt` set to the current timestamp.
3. WHEN `OfflineQueue.enqueue` is called with `type = 'CREATE'`, THE OfflineQueue SHALL accept a `localId` prefixed with `local-`.
4. WHEN `OfflineQueue.enqueue` is called with `type = 'EDIT'`, THE OfflineQueue SHALL accept a `localId` that is a Supabase UUID.
5. WHEN `OfflineQueue.getAll()` is called, THE OfflineQueue SHALL return all Queue_Items currently stored in the `pending_ops` store.
6. WHEN `OfflineQueue.getByLocalId(localId)` is called, THE OfflineQueue SHALL return the Queue_Item whose `localId` matches, or `undefined` if none exists.
7. WHEN `OfflineQueue.updateItem(id, partialPayload)` is called, THE OfflineQueue SHALL merge `partialPayload` into the existing Queue_Item identified by `id`.
8. WHEN `OfflineQueue.remove(id)` is called, THE OfflineQueue SHALL delete only the Queue_Item with the matching `id` and leave all other items unchanged.
9. THE OfflineQueue SHALL expose `getPendingCount()` which returns the number of items currently in the `pending_ops` store.
10. IF IndexedDB is unavailable (e.g., private browsing mode), THEN THE OfflineQueue SHALL export no-op stub functions and THE App SHALL display a one-time warning: "Offline saving is not available in this browser mode."

---

### Requirement 3: Create Job Card Offline

**User Story:** As a technician, I want to create a new job card while offline, so that I can record a vehicle service immediately without waiting for connectivity.

#### Acceptance Criteria

1. WHEN a technician submits the Create Job Card form and `isOnline` is `false`, THE App SHALL generate a `localId` using `crypto.randomUUID()` prefixed with `local-`.
2. WHEN a technician submits the Create Job Card form and `isOnline` is `false`, THE App SHALL call `OfflineQueue.enqueue('CREATE', localId, payload)` where `payload` contains `form`, `selectedServiceIds`, `balancingRows`, `tyreRepairRows`, `mountingDetail`, and a snapshot of `serviceCatalog`.
3. WHEN a CREATE operation is enqueued successfully, THE App SHALL navigate the technician to the `/job-cards` list page.
4. WHEN a CREATE operation is enqueued successfully, THE SyncStatusBar SHALL reflect the updated pending count without requiring a page reload.
5. WHEN a technician submits the Create Job Card form and `isOnline` is `true`, THE App SHALL follow the existing Supabase online create flow unchanged.

---

### Requirement 4: Edit Unsynced Job Card Offline

**User Story:** As a technician, I want to edit a job card that hasn't synced yet while still offline, so that I can correct mistakes before the record reaches the server.

#### Acceptance Criteria

1. WHEN a technician opens the Edit Job Card page for a `localId` prefixed with `local-` and `isOnline` is `false`, THE App SHALL load the existing draft payload from `OfflineQueue.getByLocalId(localId)`.
2. WHEN a technician submits edits for a `local-` prefixed job card and `isOnline` is `false`, THE App SHALL call `OfflineQueue.updateItem(id, newPayload)` to replace the draft in the queue.
3. WHEN a technician submits edits for a Supabase-UUID job card and `isOnline` is `false`, THE App SHALL call `OfflineQueue.enqueue('EDIT', supabaseId, payload)` to queue the update.
4. WHEN an EDIT operation is saved to the queue, THE App SHALL display a toast notification: "Changes saved locally".
5. WHEN a technician submits the Edit Job Card form and `isOnline` is `true`, THE App SHALL follow the existing Supabase online edit flow unchanged.

---

### Requirement 5: Sync Engine

**User Story:** As a technician, I want my offline job cards to be automatically sent to the server when I reconnect, so that the data is available to the whole workshop without manual intervention.

#### Acceptance Criteria

1. WHEN `SyncEngine.syncPendingOps(onProgress)` is called and `isSyncing` is already `true`, THE SyncEngine SHALL return immediately without starting a second sync.
2. WHEN `SyncEngine.syncPendingOps` processes a Queue_Item with `type = 'CREATE'`, THE SyncEngine SHALL execute the full create flow: customer upsert → vehicle upsert → job card insert → service lines replace, using the existing `queries.js` functions.
3. WHEN `SyncEngine.syncPendingOps` processes a Queue_Item with `type = 'EDIT'`, THE SyncEngine SHALL execute the full edit flow: customer update → vehicle update → job card update → service lines replace, using the existing `queries.js` functions.
4. WHEN a Queue_Item is successfully synced to Supabase, THE SyncEngine SHALL call `OfflineQueue.remove(item.id)` and invoke `onProgress(synced, total)`.
5. WHEN a Queue_Item sync attempt fails, THE SyncEngine SHALL call `OfflineQueue.updateItem(item.id, { attempts: item.attempts + 1 })` and invoke `onProgress(synced, total, error.message)` without stopping iteration over remaining items.
6. WHEN a Queue_Item has `attempts >= 3`, THE SyncEngine SHALL skip that item and not submit it to Supabase.
7. WHILE `SyncEngine.syncPendingOps` is executing, THE SyncEngine SHALL set `isSyncing` to `true`.
8. WHEN `SyncEngine.syncPendingOps` completes (successfully or after errors), THE SyncEngine SHALL set `isSyncing` to `false`.

---

### Requirement 6: Offline Context and Auto-Sync

**User Story:** As a technician, I want the app to automatically detect when I'm back online and sync my pending records, so that I don't have to remember to manually trigger a sync.

#### Acceptance Criteria

1. WHEN the browser fires the `online` event, THE OfflineContext SHALL set `isOnline` to `true` within one event-loop tick.
2. WHEN the browser fires the `offline` event, THE OfflineContext SHALL set `isOnline` to `false` within one event-loop tick.
3. WHEN `isOnline` transitions to `true` and `pendingCount` is greater than `0`, THE OfflineContext SHALL automatically call `SyncEngine.syncPendingOps`.
4. WHEN the page `visibilityState` changes to `"visible"` and `isOnline` is `true` and `pendingCount` is greater than `0`, THE OfflineContext SHALL call `SyncEngine.syncPendingOps`.
5. THE OfflineContext SHALL expose `syncNow()` which calls `SyncEngine.syncPendingOps` and can be invoked by any component for manual retry.
6. THE OfflineContext SHALL expose `pendingCount` which always equals the number of items in the `pending_ops` IndexedDB store.
7. THE OfflineContext SHALL expose `isSyncing` which reflects the current sync state from `SyncEngine.isSyncing()`.
8. THE OfflineContext SHALL expose `lastSyncError` which is set to the most recent sync error message, or `null` when no error has occurred.
9. WHEN `useOffline()` is called outside of an `<OfflineProvider>` tree, THE OfflineContext SHALL throw an error.
10. THE OfflineContext SHALL initialise `isOnline` from `navigator.onLine` at mount time.

---

### Requirement 7: Sync Status UI

**User Story:** As a technician, I want to see a clear indicator of my connectivity and sync state, so that I always know whether my work has been saved to the server.

#### Acceptance Criteria

1. WHEN `isOnline` is `true` and `pendingCount` is `0` and `lastSyncError` is `null`, THE SyncStatusBar SHALL render nothing (return `null`).
2. WHEN `isOnline` is `false`, THE SyncStatusBar SHALL display the message "You're offline — changes will sync when connected" with a red indicator.
3. WHEN `isOnline` is `true` and `isSyncing` is `true`, THE SyncStatusBar SHALL display "Syncing N record(s)…" where N equals `pendingCount`, accompanied by a spinner, with a yellow indicator.
4. WHEN `isOnline` is `true` and `isSyncing` is `false` and `pendingCount` is greater than `0`, THE SyncStatusBar SHALL display the pending count and a "Sync now" button.
5. WHEN `isOnline` is `true` and `lastSyncError` is not `null`, THE SyncStatusBar SHALL display "Sync failed" with a red indicator and a "Retry" button that calls `syncNow()`.
6. WHEN all pending records have been successfully synced, THE SyncStatusBar SHALL display "All changes synced" with a green indicator and then hide after 3 seconds.
7. THE SyncStatusBar SHALL be rendered inside `AppLayout` above the page `<Outlet />` so that it appears on every authenticated page.
8. THE SyncStatusBar SHALL have a `role="status"` attribute for screen-reader accessibility.

---

### Requirement 8: App Integration

**User Story:** As a developer, I want the offline feature to be integrated into the existing app shell without breaking any existing online functionality, so that the app continues to work correctly for online users.

#### Acceptance Criteria

1. THE App SHALL wrap the component tree with `<OfflineProvider>` in `src/main.jsx` inside the existing `<AuthProvider>`.
2. WHEN the App is built with `vite build`, THE Service_Worker SHALL be generated automatically by `vite-plugin-pwa` without manual configuration of Workbox.
3. THE App SHALL install the `vite-plugin-pwa` and `idb` packages as production dependencies without removing or modifying any existing dependencies.
4. WHEN `isOnline` is `true`, ALL existing Supabase query and mutation flows in `queries.js` SHALL remain unchanged.
5. WHEN the Supabase session expires while the device is offline and the technician reconnects, THE SyncEngine SHALL receive a 401 error, increment the Queue_Item's `attempts` counter, and set `lastSyncError` so the technician is informed.
