import { supabase } from './supabase'

// ─── Service Catalog ────────────────────────────────────────────────────────

export async function fetchServiceCatalog() {
  const { data, error } = await supabase
    .from('service_catalog')
    .select('id, name')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function findCustomerByMobile(mobile) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, mobile')
    .eq('mobile', mobile)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCustomer({ full_name, mobile }) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ full_name, mobile })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, fields) {
  const { data, error } = await supabase
    .from('customers')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Vehicles ───────────────────────────────────────────────────────────────

export async function findVehicleByPlate(plate_no) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, customer_id, plate_no, make, model, year, current_km_reading, tyre_size_front, tyre_size_rear, spare_size')
    .ilike('plate_no', plate_no)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createVehicle(fields) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateVehicle(id, fields) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Job Cards ───────────────────────────────────────────────────────────────

/**
 * Reads the highest numeric job_card_no in the table and returns the next
 * value zero-padded to at least 3 digits, e.g. "001", "002", "043", "100".
 */
export async function fetchNextJobCardNo() {
  const { data, error } = await supabase
    .from('job_cards')
    .select('job_card_no')
    .order('created_at', { ascending: false })
    .limit(100) // grab recent batch to find the highest numeric value

  if (error) throw error

  let max = 0
  for (const row of data ?? []) {
    const n = parseInt(row.job_card_no, 10)
    if (!isNaN(n) && n > max) max = n
  }

  const next = max + 1
  return String(next).padStart(3, '0')
}

export async function createJobCard(fields) {
  const { data, error } = await supabase
    .from('job_cards')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Service Lines ────────────────────────────────────────────────────────────
//
// Each element of serviceLines:
//   {
//     service_catalog_id: string,
//     quantity:           number,
//     sort_order:         number,          // position in the selected list
//     balancingRows?:     [{ tyre_position, grams_used }],
//     tyreRepairRows?:    [{ tyre_position, patch_type, patch_count }],
//     mountingDetail?:    { tyre_count, tyre_type }
//   }
//
// Flow:
//   1. Delete all existing service lines (cascades to all detail tables).
//   2. Insert one job_card_service_lines row per service, with sort_order.
//   3. Insert detail rows for Balancing, Tyre Repair, and Mounting.

export async function replaceServiceLines(job_card_id, serviceLines) {
  // 1. Delete — cascades to balancing_details, tyre_repair_details, mounting_details
  const { error: delErr } = await supabase
    .from('job_card_service_lines')
    .delete()
    .eq('job_card_id', job_card_id)
  if (delErr) throw delErr

  if (!serviceLines.length) return

  // 2. Insert service lines with explicit sort_order
  const lineInserts = serviceLines.map((sl, i) => ({
    job_card_id,
    service_catalog_id: sl.service_catalog_id,
    quantity: sl.quantity ?? 1,
    sort_order: sl.sort_order ?? i,
  }))

  const { data: insertedLines, error: lineErr } = await supabase
    .from('job_card_service_lines')
    .insert(lineInserts)
    .select('id, service_catalog_id')
  if (lineErr) throw lineErr

  // 3. Build detail inserts keyed by the newly created line id
  const balancingInserts   = []
  const tyreRepairInserts  = []
  const mountingInserts    = []

  for (const line of insertedLines) {
    const sl = serviceLines.find((s) => s.service_catalog_id === line.service_catalog_id)
    if (!sl) continue

    if (sl.balancingRows?.length) {
      sl.balancingRows.forEach((r, i) => {
        balancingInserts.push({
          service_line_id: line.id,
          tyre_position:   r.tyre_position,
          grams_used:      Number(r.grams_used),
          sort_order:      i,
        })
      })
    }

    if (sl.tyreRepairRows?.length) {
      sl.tyreRepairRows.forEach((r, i) => {
        tyreRepairInserts.push({
          service_line_id: line.id,
          tyre_position:   r.tyre_position,
          patch_type:      r.patch_type,
          patch_count:     Number(r.patch_count),
          sort_order:      i,
        })
      })
    }

    if (sl.mountingDetail) {
      mountingInserts.push({
        service_line_id:  line.id,
        number_of_tyres:  Number(sl.mountingDetail.number_of_tyres),
        tyre_type:        sl.mountingDetail.tyre_type,
      })
    }
  }

  const ops = []
  if (balancingInserts.length) {
    ops.push(supabase.from('balancing_details').insert(balancingInserts)
      .then(({ error }) => { if (error) throw error }))
  }
  if (tyreRepairInserts.length) {
    ops.push(supabase.from('tyre_repair_details').insert(tyreRepairInserts)
      .then(({ error }) => { if (error) throw error }))
  }
  if (mountingInserts.length) {
    ops.push(supabase.from('mounting_details').insert(mountingInserts)
      .then(({ error }) => { if (error) throw error }))
  }
  await Promise.all(ops)
}

// Kept for backward-compat — wraps replaceServiceLines with quantity=1, no details
export async function attachServices(job_card_id, service_catalog_ids) {
  const lines = service_catalog_ids.map((id, i) => ({
    service_catalog_id: id,
    quantity: 1,
    sort_order: i,
  }))
  await replaceServiceLines(job_card_id, lines)
}

export async function replaceServices(job_card_id, service_catalog_ids) {
  await attachServices(job_card_id, service_catalog_ids)
}

export async function fetchJobCards({ search = '', status = '', dateFrom = '', dateTo = '', page = 1, pageSize = 20 } = {}) {
  let query = supabase
    .from('job_cards')
    .select(`
      id, job_card_no, job_date, time_in, time_out, technician_name, status,
      customers ( id, full_name, mobile ),
      vehicles ( id, plate_no, make, model )
    `, { count: 'exact' })
    .order('job_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('job_date', dateFrom)
  if (dateTo) query = query.lte('job_date', dateTo)

  if (search) {
    // Search by job_card_no, plate_no, customer name, or mobile
    // We use a broad OR across related fields via text search on job_card_no
    // and filter client-side for related fields, or use a view/function.
    // For simplicity, search job_card_no directly; plate/customer handled below.
    query = query.or(
      `job_card_no.ilike.%${search}%`
    )
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function searchJobCards({ jobCardNo, plateNo, customerName, mobile, dateFrom, dateTo, status, page = 1, pageSize = 20 }) {
  let query = supabase
    .from('job_cards')
    .select(`
      id, job_card_no, job_date, time_in, time_out, technician_name, status,
      customers ( id, full_name, mobile ),
      vehicles ( id, plate_no, make, model )
    `, { count: 'exact' })
    .order('job_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Only apply server-side job_card_no filter when it's a dedicated field search,
  // not when it came from the quick-search bar (which also needs plate/mobile matching)
  if (jobCardNo && !plateNo && !mobile) {
    query = query.ilike('job_card_no', `%${jobCardNo}%`)
  }
  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('job_date', dateFrom)
  if (dateTo) query = query.lte('job_date', dateTo)

  // Fetch enough rows for client-side filtering — use a large limit when
  // quick-search is active so we don't miss matches on plate/mobile/name
  const isQuickSearch = !!(plateNo || mobile || customerName)
  const fetchSize = isQuickSearch ? 500 : pageSize
  const from = isQuickSearch ? 0 : (page - 1) * pageSize
  const to = from + fetchSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  // Client-side filter for related fields
  let filtered = data ?? []

  if (jobCardNo) {
    filtered = filtered.filter((jc) =>
      jc.job_card_no?.toLowerCase().includes(jobCardNo.toLowerCase())
    )
  }
  if (plateNo) {
    filtered = filtered.filter((jc) =>
      jc.vehicles?.plate_no?.toLowerCase().includes(plateNo.toLowerCase())
    )
  }
  if (customerName) {
    filtered = filtered.filter((jc) =>
      jc.customers?.full_name?.toLowerCase().includes(customerName.toLowerCase())
    )
  }
  if (mobile) {
    filtered = filtered.filter((jc) =>
      jc.customers?.mobile?.includes(mobile)
    )
  }

  // Apply pagination client-side when quick-search is active
  const total = isQuickSearch ? filtered.length : (count ?? 0)
  const paginated = isQuickSearch
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered

  return { data: paginated, count: total }
}

export async function fetchJobCardById(id) {
  const { data, error } = await supabase
    .from('job_cards')
    .select(`
      id, job_card_no, job_date, time_in, time_out, technician_name, status, notes, created_at, updated_at,
      customers ( id, full_name, mobile ),
      vehicles ( id, plate_no, make, model, year, current_km_reading, tyre_size_front, tyre_size_rear, spare_size ),
      job_card_service_lines (
        id, quantity, sort_order,
        service_catalog ( id, name ),
        balancing_details!balancing_details_service_line_id_fkey ( id, tyre_position, grams_used, sort_order ),
        tyre_repair_details!tyre_repair_details_service_line_id_fkey ( id, tyre_position, patch_type, patch_count, sort_order ),
        mounting_details ( id, number_of_tyres, tyre_type )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateJobCard(id, fields) {
  const { data, error } = await supabase
    .from('job_cards')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchRecentJobCards(limit = 5) {
  const { data, error } = await supabase
    .from('job_cards')
    .select(`
      id, job_card_no, job_date, status,
      customers ( full_name ),
      vehicles ( plate_no )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function fetchDashboardStats() {
  const today = new Date().toISOString().split('T')[0]

  const [openRes, completedTodayRes] = await Promise.all([
    supabase.from('job_cards').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
    supabase.from('job_cards').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED').eq('job_date', today),
  ])

  return {
    openCount: openRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
  }
}

// replaceBalancingRows and replaceTyreRepairRows are superseded by replaceServiceLines.
// Kept as no-ops so any stale imports don't crash.
export async function replaceBalancingRows() {}
export async function replaceTyreRepairRows() {}
