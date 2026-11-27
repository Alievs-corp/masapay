import type { TFunction } from 'i18next'
import { currentLocale } from '@/i18n'
import { formatCurrency } from '@/features/order/format'
import { toMinor } from '@/features/order/order-api'
import type { ReservationTable } from './types'

// Small display helpers of the reservation page and the arrival modal.

export const RESTAURANT_ZONE = 'Asia/Baku'

/** Reservation money arrives in manat; formatCurrency takes minor units. */
export function money(amount: number, currency: string): string {
  return formatCurrency(toMinor(amount), currency)
}

/** "Table T3" / "Cabin C5". */
export function tableName(
  t: TFunction<'reservations'>,
  table: Pick<ReservationTable, 'kind' | 'label'>,
): string {
  return table.kind === 'CABIN'
    ? t('view.cabin', { label: table.label })
    : t('view.table', { label: table.label })
}

/** A local YYYY-MM-DD shown as a readable date. */
export function formatLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  if (!y || !m || !d) return localDate
  return new Intl.DateTimeFormat(currentLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** An ISO instant as date + time in the restaurant zone. */
export function formatInstant(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: RESTAURANT_ZONE,
  }).format(date)
}
