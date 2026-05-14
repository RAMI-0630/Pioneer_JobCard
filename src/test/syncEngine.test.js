/**
 * syncEngine.test.js
 *
 * Property-based tests for src/lib/syncEngine.js using fast-check.
 * Mocks offlineQueue and queries.js to test sync logic in isolation.
 *
 * Properties tested:
 *   Property 4 — Sync removes successfully processed CREATE items (Req 5.2, 5.4)
 *   Property 5 — Sync removes successfully processed EDIT items (Req 5.3, 5.4)
 *   Property 6 — Failed sync increments attempts without stopping iteration (Req 5.5)
 *   Property 7 — Permanent failure guard: attempts >= 3 items are skipped (Req 5.6)
 *   Property 8 — isSyncing is false after syncPendingOps completes (Req 5.8)
 */

import * as fc from 'fast-check'
import { describe, it, beforeEach, vi, expect } from 'vitest'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal valid payload for a queue item.
 */
function makePayload() {
  return {
    form: {
      job_card_no: 'JC-001',
      mobile: '0812345678',
      plate_no: 'ABC123',
      full_name: 'Test Customer',
      job_date: '2024-01-01',
      time_in: '08:00',
      time_out: null,
      technician_name: 'Tech',
      status: 'open',
      notes: '',
      make: 'Toyota',
      model: 'Hilux',
      year: '2020',
      current_km_reading: '50000',
      tyre_size_front: '265/65R17',
      tyre_size_rear: '265/65R17',
      spare_size: '265/65R17',
    },
    selectedServiceIds: [],
    balancingRows: [],
    tyreRepairRows: [],
    mountingDetail: null,
    serviceCatalog: [],
  }
}

/**
 * Build a mock offlineQueue with the given items.
 * Returns the mock module and a spy map.
 */
function buildMockQueue(items) {
  let store = items.map(item => ({ ...item }))

  return {
    getAll: vi.fn(async () => store.map(i => ({ ...i }))),
    remove: vi.fn(async (id) => {
      store = store.filter(i => i.id !== id)
    }),
    updateItem: vi.fn(async (id, partial) => {
      store = store.map(i => i.id === id ? { ...i, ...partial } : i)
    }),
    getPendingCount: vi.fn(async () => store.length),
    getStore: () => store,
  }
}

/**
 * Build a standard queries mock where all calls succeed.
 */
function buildSuccessQueriesMock() {
  return {
    findCustomerByMobile: vi.fn().mockResolvedValue({ id: 'cust-1' }),
    createCustomer: vi.fn().mockResolvedValue({ id: 'cust-1' }),
    findVehicleByPlate: vi.fn().mockResolvedValue({ id: 'veh-1' }),
    createVehicle: vi.fn().mockResolvedValue({ id: 'veh-1' }),
    createJobCard: vi.fn().mockResolvedValue({ id: 'jc-1' }),
    fetchJobCardById: vi.fn().mockResolvedValue({
      id: 'jc-1',
      customers: { id: 'cust-1' },
      vehicles: { id: 'veh-1' },
    }),
    updateCustomer: vi.fn().mockResolvedValue({}),
    updateVehicle: vi.fn().mockResolvedValue({}),
    updateJobCard: vi.fn().mockResolvedValue({}),
    replaceServiceLines: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * Get a fresh syncEngine module with the given mocks injected.
 * Uses vi.resetModules() + vi.doMock() + dynamic import() to reset the
 * module-level `syncing` flag between tests.
 */
async function freshSyncEngine(mockQueue, mockQueries) {
  vi.resetModules()
  vi.doMock('../lib/offlineQueue.js', () => mockQueue)
  vi.doMock('../lib/queries.js', () => mockQueries)
  return import('../lib/syncEngine.js')
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const attemptsLt3 = fc.integer({ min: 0, max: 2 })
const attemptsGte3 = fc.integer({ min: 3, max: 10 })

// ─── Property 4: Sync removes successfully processed CREATE items ─────────────

/**
 * Validates: Requirements 5.2, 5.4
 *
 * For any CREATE queue item with attempts < 3, after successful syncPendingOps
 * the item is absent from the queue.
 */
describe('Property 4: Sync removes successfully processed CREATE items', () => {
  it('removes CREATE items with attempts < 3 after successful sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        attemptsLt3,
        fc.integer({ min: 1, max: 4 }),
        async (attempts, numItems) => {
          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: `local-${i + 1}`,
            type: 'CREATE',
            payload: makePayload(),
            attempts,
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)
          const mockQueries = buildSuccessQueriesMock()
          const { syncPendingOps } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          // All items should have been removed
          expect(mockQueue.remove).toHaveBeenCalledTimes(numItems)
          for (const item of items) {
            expect(mockQueue.remove).toHaveBeenCalledWith(item.id)
          }
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ─── Property 5: Sync removes successfully processed EDIT items ───────────────

/**
 * Validates: Requirements 5.3, 5.4
 *
 * For any EDIT queue item with attempts < 3, after successful syncPendingOps
 * the item is absent from the queue.
 */
describe('Property 5: Sync removes successfully processed EDIT items', () => {
  it('removes EDIT items with attempts < 3 after successful sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        attemptsLt3,
        fc.integer({ min: 1, max: 4 }),
        async (attempts, numItems) => {
          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: `supabase-uuid-${i + 1}`,
            type: 'EDIT',
            payload: makePayload(),
            attempts,
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)
          const mockQueries = buildSuccessQueriesMock()
          const { syncPendingOps } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          // All items should have been removed
          expect(mockQueue.remove).toHaveBeenCalledTimes(numItems)
          for (const item of items) {
            expect(mockQueue.remove).toHaveBeenCalledWith(item.id)
          }
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ─── Property 6: Failed sync increments attempts without stopping iteration ───

/**
 * Validates: Requirements 5.5
 *
 * For any queue where one item fails, syncPendingOps increments that item's
 * attempts and processes all remaining items.
 */
describe('Property 6: Failed sync increments attempts without stopping iteration', () => {
  it('increments attempts for failed item and processes remaining items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // total items (at least 2)
        fc.integer({ min: 0, max: 4 }),  // index of the failing item
        attemptsLt3,
        async (numItems, failIndexRaw, attempts) => {
          const failIndex = failIndexRaw % numItems

          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: `local-${i + 1}`,
            type: 'CREATE',
            payload: makePayload(),
            attempts,
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)

          // Build a queries mock that fails for the item at failIndex
          let callIndex = 0
          const mockQueries = {
            findCustomerByMobile: vi.fn(async () => {
              const currentIndex = callIndex++
              if (currentIndex === failIndex) {
                throw new Error('Simulated network failure')
              }
              return { id: 'cust-1' }
            }),
            createCustomer: vi.fn().mockResolvedValue({ id: 'cust-1' }),
            findVehicleByPlate: vi.fn().mockResolvedValue({ id: 'veh-1' }),
            createVehicle: vi.fn().mockResolvedValue({ id: 'veh-1' }),
            createJobCard: vi.fn().mockResolvedValue({ id: 'jc-1' }),
            fetchJobCardById: vi.fn().mockResolvedValue({
              id: 'jc-1',
              customers: { id: 'cust-1' },
              vehicles: { id: 'veh-1' },
            }),
            updateCustomer: vi.fn().mockResolvedValue({}),
            updateVehicle: vi.fn().mockResolvedValue({}),
            updateJobCard: vi.fn().mockResolvedValue({}),
            replaceServiceLines: vi.fn().mockResolvedValue(undefined),
          }

          const { syncPendingOps } = await freshSyncEngine(mockQueue, mockQueries)

          const progressCalls = []
          await syncPendingOps((synced, total, error) => {
            progressCalls.push({ synced, total, error })
          })

          // All items should have been processed (onProgress called for each)
          expect(progressCalls.length).toBe(numItems)

          // The failing item should have had its attempts incremented
          const failingItemId = items[failIndex].id
          expect(mockQueue.updateItem).toHaveBeenCalledWith(
            failingItemId,
            { attempts: attempts + 1 }
          )

          // The failing item should NOT have been removed
          expect(mockQueue.remove).not.toHaveBeenCalledWith(failingItemId)

          // All other items should have been removed
          for (let i = 0; i < numItems; i++) {
            if (i === failIndex) continue
            expect(mockQueue.remove).toHaveBeenCalledWith(items[i].id)
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})

// ─── Property 7: Permanent failure guard ─────────────────────────────────────

/**
 * Validates: Requirements 5.6
 *
 * For any item with attempts >= 3, syncPendingOps never calls any queries.js
 * function for it.
 */
describe('Property 7: Permanent failure guard — attempts >= 3 items are skipped', () => {
  it('never calls queries functions for items with attempts >= 3', async () => {
    await fc.assert(
      fc.asyncProperty(
        attemptsGte3,
        fc.constantFrom('CREATE', 'EDIT'),
        fc.integer({ min: 1, max: 4 }),
        async (attempts, type, numItems) => {
          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: type === 'CREATE' ? `local-${i + 1}` : `supabase-uuid-${i + 1}`,
            type,
            payload: makePayload(),
            attempts, // all items have attempts >= 3
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)
          const mockQueries = buildSuccessQueriesMock()
          const { syncPendingOps } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          // No queries functions should have been called
          expect(mockQueries.findCustomerByMobile).not.toHaveBeenCalled()
          expect(mockQueries.createCustomer).not.toHaveBeenCalled()
          expect(mockQueries.findVehicleByPlate).not.toHaveBeenCalled()
          expect(mockQueries.createVehicle).not.toHaveBeenCalled()
          expect(mockQueries.createJobCard).not.toHaveBeenCalled()
          expect(mockQueries.fetchJobCardById).not.toHaveBeenCalled()
          expect(mockQueries.updateCustomer).not.toHaveBeenCalled()
          expect(mockQueries.updateVehicle).not.toHaveBeenCalled()
          expect(mockQueries.updateJobCard).not.toHaveBeenCalled()
          expect(mockQueries.replaceServiceLines).not.toHaveBeenCalled()

          // No items should have been removed
          expect(mockQueue.remove).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ─── Property 8: isSyncing is false after syncPendingOps completes ────────────

/**
 * Validates: Requirements 5.8
 *
 * After any syncPendingOps invocation (empty queue, all succeed, some fail),
 * isSyncing is false after the returned Promise resolves.
 */
describe('Property 8: isSyncing is false after syncPendingOps completes', () => {
  it('isSyncing is false after sync with empty queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const mockQueue = buildMockQueue([])
          const mockQueries = buildSuccessQueriesMock()
          const { syncPendingOps, isSyncing } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          expect(isSyncing()).toBe(false)
        }
      ),
      { numRuns: 5 }
    )
  })

  it('isSyncing is false after sync with successful items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        attemptsLt3,
        async (numItems, attempts) => {
          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: `local-${i + 1}`,
            type: 'CREATE',
            payload: makePayload(),
            attempts,
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)
          const mockQueries = buildSuccessQueriesMock()
          const { syncPendingOps, isSyncing } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          expect(isSyncing()).toBe(false)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('isSyncing is false after sync with failing items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (numItems) => {
          const items = Array.from({ length: numItems }, (_, i) => ({
            id: i + 1,
            localId: `local-${i + 1}`,
            type: 'CREATE',
            payload: makePayload(),
            attempts: 0,
            createdAt: Date.now(),
          }))

          const mockQueue = buildMockQueue(items)
          const mockQueries = {
            ...buildSuccessQueriesMock(),
            findCustomerByMobile: vi.fn().mockRejectedValue(new Error('Network error')),
          }
          const { syncPendingOps, isSyncing } = await freshSyncEngine(mockQueue, mockQueries)

          await syncPendingOps(() => {})

          expect(isSyncing()).toBe(false)
        }
      ),
      { numRuns: 10 }
    )
  })
})
