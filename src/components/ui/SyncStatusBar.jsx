/**
 * SyncStatusBar.jsx
 *
 * Persistent banner shown at the top of the app shell when offline or when
 * there are pending items to sync. Reads state from useOffline().
 *
 * Visual states:
 *   - Online, no pending, no error, not just synced → renders null (hidden)
 *   - Offline                                       → 🔴 offline message
 *   - Online, syncing                               → 🟡 syncing N record(s)… + spinner
 *   - Online, pending > 0, not syncing              → 🟡 N pending + "Sync now" button
 *   - Online, lastSyncError                         → 🔴 "Sync failed" + "Retry" button
 *   - Online, just synced (auto-hides after 3 s)    → 🟢 "All changes synced"
 */

import { useEffect, useRef, useState } from 'react'
import { useOffline } from '../../context/OfflineContext'
import Spinner from './Spinner'

export default function SyncStatusBar() {
  const { isOnline, pendingCount, isSyncing, lastSyncError, syncNow } = useOffline()

  // Track whether a successful sync just completed so we can show the green banner.
  // Transitions from pendingCount > 0 → 0 while online trigger this.
  const [justSynced, setJustSynced] = useState(false)
  const prevPendingCountRef = useRef(pendingCount)
  const prevIsOnlineRef = useRef(isOnline)

  // Detect the transition: was pending > 0, now pending === 0, while online
  useEffect(() => {
    const wasOnline = prevIsOnlineRef.current
    const prevCount = prevPendingCountRef.current

    if (wasOnline && isOnline && prevCount > 0 && pendingCount === 0 && !lastSyncError) {
      setJustSynced(true)
    }

    prevPendingCountRef.current = pendingCount
    prevIsOnlineRef.current = isOnline
  }, [pendingCount, isOnline, lastSyncError])

  // Auto-clear the justSynced flag after 3 seconds
  useEffect(() => {
    if (!justSynced) return
    const timer = setTimeout(() => setJustSynced(false), 3000)
    return () => clearTimeout(timer)
  }, [justSynced])

  // Clear justSynced if a new error appears or we go offline
  useEffect(() => {
    if (lastSyncError || !isOnline) {
      setJustSynced(false)
    }
  }, [lastSyncError, isOnline])

  // 5.2 — Req 7.1: render nothing when online, no pending, no error, not just synced
  if (isOnline && pendingCount === 0 && !lastSyncError && !justSynced) return null

  // Determine the CSS modifier class
  let modifier = 'warning'
  if (!isOnline || lastSyncError) modifier = 'offline'
  if (justSynced) modifier = 'success'

  return (
    // 5.8 — Req 7.8: role="status" for screen-reader accessibility
    <div className={`sync-bar sync-bar--${modifier}`} role="status">
      {/* 5.3 — Req 7.2: offline state */}
      {!isOnline && (
        <span>🔴 You're offline — changes will sync when connected</span>
      )}

      {/* 5.4 — Req 7.3: syncing state */}
      {isOnline && isSyncing && (
        <span>
          🟡 Syncing {pendingCount} record(s)…{' '}
          <Spinner size={14} />
        </span>
      )}

      {/* 5.5 — Req 7.4: pending state (not syncing, has pending items) */}
      {isOnline && !isSyncing && pendingCount > 0 && !lastSyncError && (
        <span>
          🟡 {pendingCount} pending —{' '}
          <button onClick={syncNow}>Sync now</button>
        </span>
      )}

      {/* 5.6 — Req 7.5: error state */}
      {isOnline && lastSyncError && (
        <span>
          🔴 Sync failed —{' '}
          <button onClick={syncNow}>Retry</button>
        </span>
      )}

      {/* 5.7 — Req 7.6: just synced state (green, auto-hides after 3 s) */}
      {isOnline && justSynced && !lastSyncError && (
        <span>🟢 All changes synced</span>
      )}
    </div>
  )
}
