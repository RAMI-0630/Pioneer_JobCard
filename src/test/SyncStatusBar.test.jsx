/**
 * SyncStatusBar.test.jsx
 *
 * Unit tests for src/components/ui/SyncStatusBar.jsx
 *
 * Tests:
 *   7.10 — renders null when online, no pending, no error (Req 7.1)
 *   7.11 — renders offline message when isOnline is false (Req 7.2)
 *   7.12 — renders error state with Retry button when lastSyncError is set (Req 7.5)
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SyncStatusBar from '../components/ui/SyncStatusBar'

// Mock the OfflineContext so we can control what useOffline() returns
vi.mock('../context/OfflineContext', () => ({
  useOffline: vi.fn(),
}))

import { useOffline } from '../context/OfflineContext'

// ─── Default mock values ──────────────────────────────────────────────────────

const defaultOfflineState = {
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncError: null,
  syncNow: vi.fn(),
  refreshPendingCount: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  useOffline.mockReturnValue({ ...defaultOfflineState })
})

// ─── 7.10: renders null when online, no pending, no error ────────────────────

describe('7.10 — SyncStatusBar renders null when online, no pending, no error', () => {
  it('returns null when isOnline=true, pendingCount=0, lastSyncError=null', () => {
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: true,
      pendingCount: 0,
      lastSyncError: null,
    })

    const { container } = render(<SyncStatusBar />)

    // The component should render nothing
    expect(container.firstChild).toBeNull()
  })
})

// ─── 7.11: renders offline message when isOnline is false ────────────────────

describe('7.11 — SyncStatusBar renders offline message when isOnline is false', () => {
  it('displays offline message with red indicator when isOnline=false', () => {
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: false,
      pendingCount: 0,
    })

    render(<SyncStatusBar />)

    // Should show the offline message
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
    expect(screen.getByText(/changes will sync when connected/i)).toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: false,
    })

    render(<SyncStatusBar />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('applies the offline CSS modifier class', () => {
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: false,
    })

    render(<SyncStatusBar />)

    const statusBar = screen.getByRole('status')
    expect(statusBar).toHaveClass('sync-bar--offline')
  })
})

// ─── 7.12: renders error state with Retry button when lastSyncError is set ───

describe('7.12 — SyncStatusBar renders error state with Retry button when lastSyncError is set', () => {
  it('displays sync failed message and Retry button when lastSyncError is set', () => {
    const syncNow = vi.fn()
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: true,
      lastSyncError: 'Network request failed',
      syncNow,
    })

    render(<SyncStatusBar />)

    // Should show the error message
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()

    // Should show a Retry button
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('calls syncNow when Retry button is clicked', async () => {
    const syncNow = vi.fn()
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: true,
      lastSyncError: 'Network request failed',
      syncNow,
    })

    render(<SyncStatusBar />)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    retryButton.click()

    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('applies the offline CSS modifier class for error state', () => {
    useOffline.mockReturnValue({
      ...defaultOfflineState,
      isOnline: true,
      lastSyncError: 'Some error',
    })

    render(<SyncStatusBar />)

    const statusBar = screen.getByRole('status')
    expect(statusBar).toHaveClass('sync-bar--offline')
  })
})
