import {
  ALLERGENS,
  EMPTY_GUEST_REQUESTS,
  MAX_ALLERGY_NOTE,
  MAX_CHILD_SEATS,
  MAX_GUEST_NOTE,
  type GuestRequests,
  type ReservationView,
} from './types'

// Pure helpers of the guest requests (spec 11.1): the editable form value, the
// trimmed request body and the read side of a reservation.

export interface GuestNotesValue {
  note: string
  requests: GuestRequests
}

export const EMPTY_NOTES_VALUE: GuestNotesValue = {
  note: '',
  requests: EMPTY_GUEST_REQUESTS,
}

/** The requests of a reservation; an older server without the field reads as none. */
export function requestsOf(
  r: Pick<ReservationView, 'requests'>,
): GuestRequests {
  // The server sends both spellings (spec 11, BACKEND); read either.
  const raw = (r.requests ?? {}) as Partial<GuestRequests> & {
    wheelchairAccess?: boolean
    allergies?: GuestRequests['allergens']
  }
  return {
    childSeats: raw.childSeats ?? 0,
    wheelchair: raw.wheelchair ?? raw.wheelchairAccess ?? false,
    occasion: raw.occasion ?? null,
    allergens: raw.allergens ?? raw.allergies ?? [],
    allergyNote: raw.allergyNote ?? null,
  }
}

export function notesValueOf(
  r: Pick<ReservationView, 'note' | 'requests'>,
): GuestNotesValue {
  return { note: r.note ?? '', requests: requestsOf(r) }
}

/** Trimmed request body: empty texts become null, no allergy note without an allergen. */
export function toNotesRequest(value: GuestNotesValue): {
  note: string | null
  requests: GuestRequests
} {
  const note = value.note.trim().slice(0, MAX_GUEST_NOTE)
  const allergyNote = (value.requests.allergyNote ?? '')
    .trim()
    .slice(0, MAX_ALLERGY_NOTE)
  const allergens = ALLERGENS.filter((a) =>
    value.requests.allergens.includes(a),
  )
  return {
    note: note || null,
    requests: {
      childSeats: Math.min(
        Math.max(Math.trunc(value.requests.childSeats) || 0, 0),
        MAX_CHILD_SEATS,
      ),
      wheelchair: value.requests.wheelchair,
      occasion: value.requests.occasion,
      allergens,
      allergyNote: allergens.length > 0 && allergyNote ? allergyNote : null,
    },
  }
}

/** True when the guest asked for anything at all. */
export function hasAnyRequest(
  requests: GuestRequests,
  note: string | null,
): boolean {
  return (
    requests.childSeats > 0 ||
    requests.wheelchair ||
    requests.occasion !== null ||
    requests.allergens.length > 0 ||
    !!requests.allergyNote?.trim() ||
    !!note?.trim()
  )
}
