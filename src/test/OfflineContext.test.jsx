/**
 * OfflineContext.test.jsx
 *
 * Unit tests for src/context/OfflineContext.jsx
 *
 * Tests:
 *   7.13 — useOffline() throws when called outside <OfflineProvider> (Req 6.9)
 */

import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useOffline } from '../context/OfflineContext'

// ─── Mock dependencies that OfflineContext imports ────────────────────────────

// Mock offlineQueue so we don't need a real IndexedDB
vi.mock('../lib/offlineQueue', () => ({
  isAvailable: true,
  getPendingCount: vi.fn().mockResolvedValue(0),
  getAll: vi.fn().mockResolvedValue([]),
  enqueue: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}))

// Mock syncEngine so we don't trigger real sync operations
vi.mock('../lib/syncEngine', () => ({
  syncPendingOps: vi.fn().mockResolvedValue(undefined),
  isSyncing: vi.fn().mockReturnValue(false),
}))

// ─── 7.13: useOffline() throws when called outside <OfflineProvider> ─────────

describe('7.13 — useOffline() throws when called outside <OfflineProvider>', () => {
  it('throws an error when useOffline is called outside OfflineProvider', () => {
    // A component that calls useOffline() without being wrapped in OfflineProvider
    function ComponentWithoutProvider() {
      useOffline() // This should throw
      return <div>Should not render</div>
    }

    // Suppress the React error boundary console output during this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<ComponentWithoutProvider />)
    }).toThrow('useOffline must be used within an <OfflineProvider>')

    consoleError.mockRestore()
  })

  it('throws with a descriptive error message', () => {
    function ComponentWithoutProvider() {
      useOffline()
      return null
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    let thrownError = null
    try {
      render(<ComponentWithoutProvider />)
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).not.toBeNull()
    expect(thrownError.message).toContain('OfflineProvider')

    consoleError.mockRestore()
  })
})
