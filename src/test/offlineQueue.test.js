/**
 * offlineQueue.test.js
 *
 * Property-based tests for src/lib/offlineQueue.js using fast-check.
 * Uses fake-indexeddb to run IndexedDB in Node/jsdom without a real browser.
 *
 * Properties tested:
 *   Property 1 — Enqueue round-trip stores correct item (Req 2.2, 2.5, 2.6)
 *   Property 2 — getPendingCount invariant (Req 2.9, 6.6)
 *   Property 3 — remove is targeted (Req 2.8)
 *
 * Strategy: Each test file gets a fresh IDBFactory via beforeEach. We use
 * vi.resetModules() + dynamic import() to get a fresh offlineQueue module
 * (which re-opens the DB) for each fast-check run.
 *
 * Note: vi.resetModules() must be called before each dynamic import to ensure
 * the module-level dbPromise is re-initialised with the new IDBFactory.
 */

import * as fc from 'fast-check'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, beforeEach, vi } from 'vitest'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const typeArb = fc.constantFrom('CREATE', 'EDIT')

// Use alphanumeric strings to avoid any encoding issues with localId
const localIdArb = fc.stringMatching(/^[a-zA-Z0-9]{3,20}$/)

const payloadArb = fc.record({
  form: fc.record({
    job_card_no: fc.stringMatching(/^[A-Z0-9]{3,10}$/),
    mobile: fc.stringMatching(/^[0-9]{7,12}$/),
    plate_no: fc.stringMatching(/^[A-Z0-9]{3,8}$/),
  }),
  selectedServiceIds: fc.array(fc.uuid(), { maxLength: 3 }),
  balancingRows: fc.array(
    fc.record({ tyre_position: fc.constantFrom('FL', 'FR', 'RL', 'RR'), grams_used: fc.nat({ max: 200 }) }),
    { maxLength: 4 }
  ),
  tyreRepairRows: fc.array(
    fc.record({ tyre_position: fc.constantFrom('FL', 'FR', 'RL', 'RR'), patch_count: fc.nat({ max: 5 }) }),
    { maxLength: 4 }
  ),
  mountingDetail: fc.option(
    fc.record({ number_of_tyres: fc.constantFrom('1', '2', '4'), tyre_type: fc.constantFrom('summer', 'winter') }),
    { nil: null }
  ),
  serviceCatalog: fc.array(
    fc.record({ id: fc.uuid(), name: fc.constantFrom('Balancing', 'Tyre Repair', 'Mounting') }),
    { minLength: 0, maxLength: 3 }
  ),
})

// ─── Property 1: Enqueue round-trip ──────────────────────────────────────────

/**
 * Validates: Requirements 2.2, 2.5, 2.6
 *
 * For any valid type, localId, and payload, enqueue then getAll returns an item
 * with matching payload, attempts: 0, and correct localId.
 */
describe('Property 1: enqueue round-trip stores correct item', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory()
    vi.resetModules()
  })

  it('stores item with correct payload, attempts=0, and localId', async () => {
    await fc.assert(
      fc.asyncProperty(
        typeArb,
        localIdArb,
        payloadArb,
        async (type, localId, payload) => {
          // Reset IDB and module for each run
          global.indexedDB = new IDBFactory()
          vi.resetModules()
          const { enqueue, getAll } = await import('../lib/offlineQueue.js')

          await enqueue(type, localId, payload)
          const items = await getAll()

          const item = items.find(i => i.localId === localId)
          expect(item).toBeDefined()
          expect(item.attempts).toBe(0)
          expect(item.payload).toEqual(payload)
          expect(item.type).toBe(type)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ─── Property 2: getPendingCount invariant ────────────────────────────────────

/**
 * Validates: Requirements 2.9, 6.6
 *
 * For any sequence of enqueue and remove calls, getPendingCount() always equals
 * the number of enqueued items minus the number of successfully removed items.
 */
describe('Property 2: getPendingCount invariant', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory()
    vi.resetModules()
  })

  it('equals enqueued minus removed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate between 1 and 6 items to enqueue
        fc.array(
          fc.tuple(typeArb, localIdArb, payloadArb),
          { minLength: 1, maxLength: 6 }
        ),
        // Generate how many of those items to remove (0 to all)
        fc.nat({ max: 6 }),
        async (items, removeCount) => {
          // Reset IDB and module for each run
          global.indexedDB = new IDBFactory()
          vi.resetModules()
          const { enqueue, remove, getPendingCount } = await import('../lib/offlineQueue.js')

          // Enqueue all items
          const enqueuedItems = []
          for (const [type, localId, payload] of items) {
            const item = await enqueue(type, localId, payload)
            enqueuedItems.push(item)
          }

          const totalEnqueued = enqueuedItems.length
          const actualRemoveCount = Math.min(removeCount, totalEnqueued)

          // Remove the first `actualRemoveCount` items
          for (let i = 0; i < actualRemoveCount; i++) {
            await remove(enqueuedItems[i].id)
          }

          const count = await getPendingCount()
          expect(count).toBe(totalEnqueued - actualRemoveCount)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ─── Property 3: remove is targeted ──────────────────────────────────────────

/**
 * Validates: Requirements 2.8
 *
 * For any queue with N items, remove(id) leaves N−1 items and the removed item
 * is absent from getAll().
 */
describe('Property 3: remove is targeted', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory()
    vi.resetModules()
  })

  it('leaves N-1 items and removed item is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate between 1 and 5 items
        fc.array(
          fc.tuple(typeArb, localIdArb, payloadArb),
          { minLength: 1, maxLength: 5 }
        ),
        // Index of the item to remove
        fc.nat({ max: 4 }),
        async (items, removeIndex) => {
          // Reset IDB and module for each run
          global.indexedDB = new IDBFactory()
          vi.resetModules()
          const { enqueue, remove, getAll, getPendingCount } = await import('../lib/offlineQueue.js')

          // Enqueue all items
          const enqueuedItems = []
          for (const [type, localId, payload] of items) {
            const item = await enqueue(type, localId, payload)
            enqueuedItems.push(item)
          }

          const N = enqueuedItems.length
          const targetIndex = removeIndex % N
          const targetItem = enqueuedItems[targetIndex]

          // Remove the target item
          await remove(targetItem.id)

          // Verify count is N-1
          const count = await getPendingCount()
          expect(count).toBe(N - 1)

          // Verify the removed item is absent
          const remaining = await getAll()
          const found = remaining.find(i => i.id === targetItem.id)
          expect(found).toBeUndefined()

          // Verify all other items are still present
          for (let i = 0; i < N; i++) {
            if (i === targetIndex) continue
            const stillPresent = remaining.find(item => item.id === enqueuedItems[i].id)
            expect(stillPresent).toBeDefined()
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})
