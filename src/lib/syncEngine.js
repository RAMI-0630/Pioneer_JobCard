/**
 * syncEngine.js
 *
 * Reads the offline queue and replays each pending operation against Supabase
 * using the existing queries.js functions.
 *
 * Exported interface:
 *   syncPendingOps(onProgress)  – flush the queue; onProgress(synced, total, error?)
 *   isSyncing()                 – returns true while a sync run is in progress
 */

import * as offlineQueue from './offlineQueue'
import {
  findCustomerByMobile,
  createCustomer,
  findVehicleByPlate,
  createVehicle,
  createJobCard,
  fetchJobCardById,
  fetchNextJobCardNo,
  updateCustomer,
  updateVehicle,
  updateJobCard,
  replaceServiceLines,
} from './queries'

// ─── 3.1 Module-level syncing flag ───────────────────────────────────────────

let syncing = false

/**
 * Returns true while syncPendingOps is executing, false otherwise.
 * @returns {boolean}
 */
export function isSyncing() {
  return syncing
}

// ─── Helper: buildServiceLines (mirrors CreateJobCardPage / EditJobCardPage) ──

/**
 * Converts the raw form selections into the shape expected by replaceServiceLines.
 *
 * @param {string[]} selectedServiceIds
 * @param {object[]} balancingRows
 * @param {object[]} tyreRepairRows
 * @param {object|null} mountingDetail
 * @param {object[]} serviceCatalog
 * @returns {object[]}
 */
function buildServiceLines(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog) {
  return selectedServiceIds.map((id) => {
    const svc  = serviceCatalog.find((s) => s.id === id)
    const name = svc?.name?.toLowerCase() ?? ''

    if (name === 'balancing' && balancingRows.length)
      return { service_catalog_id: id, quantity: balancingRows.length, balancingRows }

    if (name === 'tyre repair' && tyreRepairRows.length)
      return { service_catalog_id: id, quantity: tyreRepairRows.length, tyreRepairRows }

    if (name === 'mounting' && mountingDetail)
      return { service_catalog_id: id, quantity: Number(mountingDetail.number_of_tyres) || 1, mountingDetail }

    return { service_catalog_id: id, quantity: 1 }
  })
}

// ─── 3.2 replayCreate ────────────────────────────────────────────────────────

/**
 * Mirrors CreateJobCardPage.handleSubmit:
 *   customer upsert → vehicle upsert → job card insert → service lines replace
 *
 * @param {object} payload  Queue item payload
 * @returns {Promise<void>}
 */
export async function replayCreate(payload) {
  const { form, selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog } = payload

  // 1. Customer upsert
  let customer = await findCustomerByMobile(form.mobile)
  if (!customer) {
    customer = await createCustomer({ full_name: form.full_name, mobile: form.mobile })
  }

  // 2. Vehicle upsert
  let vehicle = await findVehicleByPlate(form.plate_no)
  if (!vehicle) {
    vehicle = await createVehicle({
      customer_id: customer.id,
      plate_no: form.plate_no,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      current_km_reading: form.current_km_reading ? Number(form.current_km_reading) : null,
      tyre_size_front: form.tyre_size_front || null,
      tyre_size_rear: form.tyre_size_rear || null,
      spare_size: form.spare_size || null,
    })
  }

  // 3. Assign a real job card number at sync time.
  // Offline job cards are saved with a placeholder ('---') so we always
  // fetch the next available number here to avoid unique constraint conflicts.
  const job_card_no = await fetchNextJobCardNo()

  // 4. Create job card
  const jobCard = await createJobCard({
    job_card_no,
    customer_id: customer.id,
    vehicle_id: vehicle.id,
    job_date: form.job_date,
    time_in: form.time_in || null,
    time_out: form.time_out || null,
    technician_name: form.technician_name || null,
    status: form.status,
    notes: form.notes || null,
  })

  // 5. Build and replace service lines
  const serviceLines = buildServiceLines(
    selectedServiceIds,
    balancingRows,
    tyreRepairRows,
    mountingDetail,
    serviceCatalog,
  )
  await replaceServiceLines(jobCard.id, serviceLines)
}

// ─── 3.3 replayEdit ──────────────────────────────────────────────────────────

/**
 * Mirrors EditJobCardPage.handleSubmit:
 *   customer update → vehicle update → job card update → service lines replace
 *
 * @param {string} localId  The Supabase UUID of the job card to update
 * @param {object} payload  Queue item payload
 * @returns {Promise<void>}
 */
export async function replayEdit(localId, payload) {
  const { form, selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog } = payload

  // Fetch the existing job card to get customer_id and vehicle_id
  const jc = await fetchJobCardById(localId)

  // 1. Update customer
  if (jc.customers?.id) {
    await updateCustomer(jc.customers.id, { full_name: form.full_name, mobile: form.mobile })
  }

  // 2. Update vehicle
  if (jc.vehicles?.id) {
    await updateVehicle(jc.vehicles.id, {
      plate_no: form.plate_no,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      current_km_reading: form.current_km_reading ? Number(form.current_km_reading) : null,
      tyre_size_front: form.tyre_size_front || null,
      tyre_size_rear: form.tyre_size_rear || null,
      spare_size: form.spare_size || null,
    })
  }

  // 3. Update job card
  await updateJobCard(localId, {
    job_card_no: form.job_card_no,
    job_date: form.job_date,
    time_in: form.time_in || null,
    time_out: form.time_out || null,
    technician_name: form.technician_name || null,
    status: form.status,
    notes: form.notes || null,
  })

  // 4. Build and replace service lines
  const serviceLines = buildServiceLines(
    selectedServiceIds,
    balancingRows,
    tyreRepairRows,
    mountingDetail,
    serviceCatalog,
  )
  await replaceServiceLines(localId, serviceLines)
}

// ─── 3.4 syncPendingOps ──────────────────────────────────────────────────────

/**
 * Flushes the offline queue by replaying each pending operation against Supabase.
 *
 * Guards against concurrent runs. Skips items with attempts >= 3.
 * Calls onProgress(synced, total, error?) after each item is processed.
 * Resets the syncing flag on completion regardless of errors.
 *
 * @param {(synced: number, total: number, error?: string) => void} onProgress
 * @returns {Promise<void>}
 */
export async function syncPendingOps(onProgress) {
  // 3.4 — Req 5.1: guard against concurrent runs
  if (syncing) return
  syncing = true

  try {
    const items = await offlineQueue.getAll()
    const total = items.length
    let synced = 0

    for (const item of items) {
      // Req 5.6: skip permanently failed items
      if (item.attempts >= 3) continue

      try {
        if (item.type === 'CREATE') {
          await replayCreate(item.payload)
        } else if (item.type === 'EDIT') {
          await replayEdit(item.localId, item.payload)
        }

        // Req 5.4: remove on success and report progress
        await offlineQueue.remove(item.id)
        synced += 1
        onProgress(synced, total)
      } catch (err) {
        // Req 5.5: increment attempts on failure, continue iteration
        await offlineQueue.updateItem(item.id, { attempts: item.attempts + 1 })
        onProgress(synced, total, err.message)
      }
    }
  } finally {
    // Req 5.8: always reset syncing flag
    syncing = false
  }
}
