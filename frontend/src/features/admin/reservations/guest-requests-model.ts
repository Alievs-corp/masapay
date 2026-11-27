import { useAppSelector } from '@/app/hooks'
import type {
  Allergen,
  GuestRequests,
  ReservationView,
} from '@/features/reservations/types'
import { bakuToday } from './baku-time'
import { useDayReservationsQuery } from './staff-reservations-api'

// Guest requests and allergies on staff screens (spec section 11). The backend sends
// both spellings (allergens / allergies, wheelchair / wheelchairAccess); staff screens
// accept either so they keep working whichever one the frontend types settle on.

/** What staff need to know about a guest, whatever spelling the server used. */
export interface StaffRequests {
  childSeats: number
  wheelchair: boolean
  occasion: string | null
  allergens: Allergen[]
  allergyNote: string | null
}

type LooseRequests = Partial<GuestRequests> & {
  allergies?: Allergen[] | null
  wheelchairAccess?: boolean | null
}

export function staffRequests(
  reservation: Pick<ReservationView, 'requests'>,
): StaffRequests {
  const raw = (reservation.requests ?? {}) as LooseRequests
  const allergens = raw.allergens ?? raw.allergies ?? []
  return {
    childSeats: raw.childSeats ?? 0,
    wheelchair: Boolean(raw.wheelchair ?? raw.wheelchairAccess),
    occasion: raw.occasion ?? null,
    allergens: [...new Set(allergens)],
    allergyNote: raw.allergyNote?.trim() ? raw.allergyNote.trim() : null,
  }
}

export function hasAllergy(
  requests: Pick<StaffRequests, 'allergens' | 'allergyNote'>,
): boolean {
  return requests.allergens.length > 0 || requests.allergyNote !== null
}

export function hasAnyRequest(requests: StaffRequests): boolean {
  return (
    hasAllergy(requests) ||
    requests.childSeats > 0 ||
    requests.wheelchair ||
    requests.occasion !== null
  )
}

/** Allergy of a seated reservation at a table, for the bill and kitchen screens. */
export interface TableAllergy {
  code: string
  guestName: string
  allergens: Allergen[]
  allergyNote: string | null
}

/**
 * Allergies of today's SEATED reservations by table id. Only managers and waiters may
 * read the staff reservations API, so for a chef this returns an empty map (the kitchen
 * screen then relies on the allergy the kitchen endpoint sends on each line).
 */
export function useSeatedAllergies(
  restaurantId: string | null,
): Map<string, TableAllergy> {
  const role = useAppSelector((state) => state.auth.user?.role)
  const canRead =
    role === 'SUPER_ADMIN' || role === 'RESTO_MANAGER' || role === 'WAITER'
  const day = useDayReservationsQuery(
    { restaurantId: restaurantId ?? '', date: bakuToday() },
    { skip: !restaurantId || !canRead, pollingInterval: 30000 },
  )
  const byTable = new Map<string, TableAllergy>()
  for (const reservation of day.data ?? []) {
    if (reservation.status !== 'SEATED') continue
    const requests = staffRequests(reservation)
    if (!hasAllergy(requests)) continue
    byTable.set(reservation.table.tableId, {
      code: reservation.code,
      guestName: reservation.guestName,
      allergens: requests.allergens,
      allergyNote: requests.allergyNote,
    })
  }
  return byTable
}
