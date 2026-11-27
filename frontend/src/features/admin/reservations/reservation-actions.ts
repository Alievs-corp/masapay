import type { ReservationView } from '@/features/reservations/types'

export type ReservationAction = 'seat' | 'complete' | 'cancel' | 'noShow'

/** The actions staff may take on a reservation in its current status. */
export function availableActions(
  reservation: Pick<ReservationView, 'status'>,
): ReservationAction[] {
  if (reservation.status === 'CONFIRMED') return ['seat', 'cancel', 'noShow']
  if (reservation.status === 'SEATED') return ['complete']
  return []
}
