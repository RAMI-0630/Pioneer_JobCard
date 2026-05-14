/**
 * offlineQueue.js
 *
 * Thin wrapper around IndexedDB (via `idb`) that stores pending
 * create/edit operations for the Pioneer Job Cards app.
 *
 * Database : pioneer_offline
 * Store    : pending_ops  (keyPath: 'id', autoIncrement: true)
 * Index    : by_localId   on 'localId'
 *
 * Queue_Item shape:
 * {
 *   id         : number          – IDB auto-increment key
 *   localId    : string          – "local-<uuid>" (CREATE) | Supabase UUID (EDIT)
 *   type       : 'CREATE'|'EDIT'
 *   payload    : { form, selectedServiceIds, balancingRows,
 *                  tyreRepairRows, mountingDetail, serviceCatalog }
 *   createdAt  : number          – Date.now()
 *   attempts   : number          – retry counter
 * }
 */

import { openDB } from 'idb';

const DB_NAME = 'pioneer_offline';
const STORE_NAME = 'pending_ops';
const DB_VERSION = 1;

// ─── Module-level availability flag ──────────────────────────────────────────

/**
 * `true` when IndexedDB opened successfully; `false` when unavailable
 * (e.g. private-browsing mode on some browsers).
 */
export let isAvailable = true;

// ─── Database initialisation ──────────────────────────────────────────────────

let dbPromise;

try {
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db
          .createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
          .createIndex('by_localId', 'localId', { unique: false });
      }
    },
  });

  // Eagerly surface any connection error (e.g. security errors in private mode)
  dbPromise.catch(() => {
    isAvailable = false;
    dbPromise = null;
  });
} catch (err) {
  isAvailable = false;
  dbPromise = null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getDb() {
  if (!dbPromise) {
    throw new Error('IndexedDB is not available');
  }
  return dbPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insert a new Queue_Item into `pending_ops`.
 *
 * @param {'CREATE'|'EDIT'} type
 * @param {string}          localId  – "local-<uuid>" for CREATE; Supabase UUID for EDIT
 * @param {object}          payload  – { form, selectedServiceIds, balancingRows,
 *                                       tyreRepairRows, mountingDetail, serviceCatalog }
 * @returns {Promise<object>} The stored item (including the auto-assigned `id`)
 */
export async function enqueue(type, localId, payload) {
  if (!isAvailable) return undefined;

  const db = await getDb();
  const item = {
    localId,
    type,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };

  const id = await db.add(STORE_NAME, item);
  return { ...item, id };
}

/**
 * Return all Queue_Items currently in `pending_ops`.
 *
 * @returns {Promise<object[]>}
 */
export async function getAll() {
  if (!isAvailable) return [];

  const db = await getDb();
  return db.getAll(STORE_NAME);
}

/**
 * Return the first Queue_Item whose `localId` matches, or `undefined`.
 *
 * @param {string} localId
 * @returns {Promise<object|undefined>}
 */
export async function getByLocalId(localId) {
  if (!isAvailable) return undefined;

  const db = await getDb();
  const index = db.transaction(STORE_NAME).store.index('by_localId');
  return index.get(localId);
}

/**
 * Merge `partialPayload` into the existing Queue_Item identified by `id`.
 *
 * @param {number} id
 * @param {object} partialPayload  – fields to merge into the stored item
 * @returns {Promise<void>}
 */
export async function updateItem(id, partialPayload) {
  if (!isAvailable) return;

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const existing = await tx.store.get(id);

  if (!existing) {
    await tx.done;
    return;
  }

  await tx.store.put({ ...existing, ...partialPayload, id });
  await tx.done;
}

/**
 * Delete the Queue_Item with the given key.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function remove(id) {
  if (!isAvailable) return;

  const db = await getDb();
  return db.delete(STORE_NAME, id);
}

/**
 * Delete all items from `pending_ops`.
 *
 * @returns {Promise<void>}
 */
export async function clear() {
  if (!isAvailable) return;

  const db = await getDb();
  return db.clear(STORE_NAME);
}

/**
 * Return the number of items currently in `pending_ops`.
 *
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  if (!isAvailable) return 0;

  const db = await getDb();
  return db.count(STORE_NAME);
}
