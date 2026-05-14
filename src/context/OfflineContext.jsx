/**
 * OfflineContext.jsx
 *
 * React context that tracks online/offline status, pending queue count,
 * and sync state. Consumed by any component that needs to react to connectivity.
 *
 * Exported interface:
 *   OfflineProvider({ children })  – wraps the component tree
 *   useOffline()                   – returns context value; throws if used outside provider
 *
 * Context value shape:
 *   {
 *     isOnline: boolean,
 *     pendingCount: number,
 *     isSyncing: boolean,
 *     lastSyncError: string | null,
 *     syncNow: () => Promise<void>,
 *     refreshPendingCount: () => Promise<void>,
 *   }
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as offlineQueue from '../lib/offlineQueue'
import * as syncEngine from '../lib/syncEngine'

// ─── Context ─────────────────────────────────────────────────────────────────

const OfflineContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Wraps the component tree and provides offline/sync state to all descendants.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function OfflineProvider({ children }) {
  // 4.1 — Req 6.10: initialise isOnline from navigator.onLine at mount
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState(null)

  // 4.8 — Req 2.10: one-time warning when IndexedDB is unavailable
  const [showIdbWarning, setShowIdbWarning] = useState(() => !offlineQueue.isAvailable)

  // Keep a ref to pendingCount so event-listener callbacks always see the
  // latest value without needing to be re-registered.
  const pendingCountRef = useRef(pendingCount)
  useEffect(() => {
    pendingCountRef.current = pendingCount
  }, [pendingCount])

  // Keep a ref to isOnline for the same reason.
  const isOnlineRef = useRef(isOnline)
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  // ─── 4.6 refreshPendingCount ───────────────────────────────────────────────

  /**
   * Reads the current count from IndexedDB and updates state.
   * Req 6.6: pendingCount always equals items in pending_ops store.
   */
  const refreshPendingCount = useCallback(async () => {
    const count = await offlineQueue.getPendingCount()
    setPendingCount(count)
    pendingCountRef.current = count
  }, [])

  // ─── 4.4 syncNow ──────────────────────────────────────────────────────────

  /**
   * Calls syncEngine.syncPendingOps with a progress callback that updates
   * isSyncing, pendingCount, and lastSyncError.
   * Req 6.5: exposed for manual retry.
   */
  const syncNow = useCallback(async () => {
    setIsSyncing(true)
    setLastSyncError(null)

    await syncEngine.syncPendingOps(async (_synced, _total, error) => {
      // Update isSyncing from the engine's own flag
      setIsSyncing(syncEngine.isSyncing())
      // Refresh the pending count after each item is processed
      await refreshPendingCount()
      // Capture the most recent error, if any
      if (error) {
        setLastSyncError(error)
      }
    })

    // Final state update once the loop is done
    setIsSyncing(false)
    await refreshPendingCount()
  }, [refreshPendingCount])

  // Keep a stable ref to syncNow for use inside event listeners
  const syncNowRef = useRef(syncNow)
  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  // ─── 4.2 & 4.3 Event listeners ────────────────────────────────────────────

  useEffect(() => {
    // Req 6.1: online event → set isOnline true within one event-loop tick
    const handleOnline = () => {
      setIsOnline(true)
      isOnlineRef.current = true
      // 4.5 — Req 6.3: auto-sync when coming online with pending items
      if (pendingCountRef.current > 0) {
        syncNowRef.current()
      }
    }

    // Req 6.2: offline event → set isOnline false within one event-loop tick
    const handleOffline = () => {
      setIsOnline(false)
      isOnlineRef.current = false
    }

    // Req 6.4: visibilitychange → sync if visible, online, and pending items exist
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isOnlineRef.current &&
        pendingCountRef.current > 0
      ) {
        syncNowRef.current()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Clean up all listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // empty deps — refs keep the callbacks fresh

  // ─── Initialise pending count on mount ────────────────────────────────────

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  // ─── Context value (memoised for stable reference) ────────────────────────

  const value = useMemo(
    () => ({
      isOnline,
      pendingCount,
      isSyncing,
      lastSyncError,
      syncNow,
      refreshPendingCount,
    }),
    [isOnline, pendingCount, isSyncing, lastSyncError, syncNow, refreshPendingCount],
  )

  return (
    <OfflineContext.Provider value={value}>
      {/* 4.8 — Req 2.10: one-time IndexedDB unavailability warning banner */}
      {showIdbWarning && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#f59e0b',
            color: '#1c1917',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          }}
        >
          <span>
            ⚠️ Offline saving is not available in this browser mode.
          </span>
          <button
            onClick={() => setShowIdbWarning(false)}
            aria-label="Dismiss warning"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0 0.25rem',
            }}
          >
            ×
          </button>
        </div>
      )}
      {children}
    </OfflineContext.Provider>
  )
}

// ─── 4.7 useOffline hook ──────────────────────────────────────────────────────

/**
 * Returns the OfflineContext value.
 * Req 6.9: throws if called outside <OfflineProvider>.
 *
 * @returns {{ isOnline: boolean, pendingCount: number, isSyncing: boolean,
 *             lastSyncError: string|null, syncNow: Function,
 *             refreshPendingCount: Function }}
 */
export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (ctx === null) {
    throw new Error('useOffline must be used within an <OfflineProvider>')
  }
  return ctx
}
