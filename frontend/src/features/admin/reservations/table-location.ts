import type { AdminTable } from '@/features/admin/tables/tables-api'
import type { TableKind, TableLocation } from '@/features/reservations/types'

// Pure helpers of the table location dialog (docs/RESERVATIONS-SPEC.md).

/** The table's saved place, or a sensible default for a table that has none yet. */
export function locationOf(table: Partial<AdminTable>): TableLocation {
  return {
    kind: table.kind ?? 'TABLE',
    floor: table.floor ?? 1,
    zone: table.zone ?? null,
    locationDescription: table.locationDescription ?? null,
    seats: table.seats ?? 4,
    x: table.x ?? 0,
    y: table.y ?? 0,
    w: table.w ?? 10,
    h: table.h ?? 10,
  }
}

export type NumberKey = 'floor' | 'seats' | 'x' | 'y' | 'w' | 'h'

export type LocationDraft = Record<NumberKey, string> & {
  kind: TableKind
  zone: string
  locationDescription: string
}

export function draftOf(location: TableLocation): LocationDraft {
  return {
    kind: location.kind,
    floor: String(location.floor),
    seats: String(location.seats),
    x: String(location.x),
    y: String(location.y),
    w: String(location.w),
    h: String(location.h),
    zone: location.zone ?? '',
    locationDescription: location.locationDescription ?? '',
  }
}

function intIn(value: string, min: number, max: number): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null
  const n = Number(value)
  return n >= min && n <= max ? n : null
}

function gridIn(value: string, min: number): number | null {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null
  const n = Number(value)
  return n >= min && n <= 100 ? n : null
}

/** Validates the draft; null when a field is out of range or the box leaves the 0-100 grid. */
export function parseLocation(draft: LocationDraft): TableLocation | null {
  const floor = intIn(draft.floor, -5, 50)
  const seats = intIn(draft.seats, 1, 100)
  const x = gridIn(draft.x, 0)
  const y = gridIn(draft.y, 0)
  const w = gridIn(draft.w, 1)
  const h = gridIn(draft.h, 1)
  if (
    floor === null ||
    seats === null ||
    x === null ||
    y === null ||
    w === null ||
    h === null ||
    x + w > 100 ||
    y + h > 100
  ) {
    return null
  }
  return {
    kind: draft.kind,
    floor,
    seats,
    x,
    y,
    w,
    h,
    zone: draft.zone.trim() || null,
    locationDescription: draft.locationDescription.trim() || null,
  }
}
