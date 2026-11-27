// Codes of the guest's own reservations on this phone (localStorage
// "masapay.reservations", a JSON array, newest first; the reserve flow writes it).
// Storage can be missing or blocked, so every access is wrapped.

export const STORED_RESERVATIONS_KEY = 'masapay.reservations'
const MAX_CODES = 10

export function readReservationCodes(): string[] {
  try {
    const raw = window.localStorage.getItem(STORED_RESERVATIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === 'string' && !!c)
  } catch {
    return []
  }
}

export function rememberReservationCode(code: string) {
  try {
    const codes = [code, ...readReservationCodes().filter((c) => c !== code)]
    window.localStorage.setItem(
      STORED_RESERVATIONS_KEY,
      JSON.stringify(codes.slice(0, MAX_CODES)),
    )
  } catch {
    // Storage blocked: the modal then only shows on the reservation page.
  }
}
