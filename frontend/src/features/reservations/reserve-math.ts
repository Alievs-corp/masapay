import type { ReservationRules } from './types'

// Pure helpers of the reserve flow: bookable dates, time slots and the
// pre-order preview. The preview is in integer minor units (no float sums);
// the authoritative totals always come back from the server.

/** Every YYYY-MM-DD from `today` to `last`, both included (at most 60). */
export function bookableDates(today: string, last: string): string[] {
  const start = parseDate(today)
  const end = parseDate(last)
  if (!start || !end || end < start) return today ? [today] : []
  const dates: string[] = []
  for (let d = start; d <= end && dates.length < 60;) {
    dates.push(formatDate(d))
    d = new Date(d.getTime() + 86_400_000)
  }
  return dates
}

export function isDateBookable(date: string, today: string, last: string) {
  return bookableDates(today, last).includes(date)
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Current HH:mm in the restaurant time zone. */
export function nowInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/**
 * Half-hour start times of a day. For today only times after `nowTime`
 * (HH:mm) are offered.
 */
export function timeSlots(isToday: boolean, nowTime: string): string[] {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const slot = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    if (!isToday || slot > nowTime) slots.push(slot)
  }
  return slots
}

export interface PreorderLine {
  /** Minor units. */
  unitPrice: number
  quantity: number
}

export interface TotalsPreview {
  itemsTotal: number
  deposit: number
  amountDue: number
  payNow: number
  remaining: number
}

/**
 * Mirrors the server formula (spec section 2) in minor units:
 * deposit = FIXED value or PERCENT of the items (half up), amountDue =
 * max(items, deposit), pay now = deposit when set, else the items.
 */
export function previewTotals(
  lines: PreorderLine[],
  rules: Pick<ReservationRules, 'depositType' | 'depositValue'>,
): TotalsPreview {
  const itemsTotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  )
  let deposit = 0
  if (rules.depositType === 'FIXED') {
    deposit = Math.round(rules.depositValue * 100)
  } else if (rules.depositType === 'PERCENT') {
    // Percent as an integer of hundredths avoids float error before rounding.
    const percentHundredths = Math.round(rules.depositValue * 100)
    deposit = Math.floor((itemsTotal * percentHundredths + 5000) / 10000)
  }
  const amountDue = Math.max(itemsTotal, deposit)
  const payNow = deposit > 0 ? deposit : itemsTotal
  return {
    itemsTotal,
    deposit,
    amountDue,
    payNow,
    remaining: amountDue - payNow,
  }
}

export interface ReserveDetails {
  date: string
  time: string
  partySize: number
  tableId: string | null
  guestName: string
  guestPhone: string
}

export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

export function detailsComplete(details: ReserveDetails): boolean {
  return (
    !!details.tableId &&
    !!details.time &&
    details.guestName.trim().length > 0 &&
    PHONE_PATTERN.test(details.guestPhone.trim())
  )
}
