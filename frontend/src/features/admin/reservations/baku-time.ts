// Reservations are booked in the restaurant's time zone (Asia/Baku), whatever
// the staff device's own zone is.

const BAKU = 'Asia/Baku'

function parts(now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: BAKU,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return values as Record<string, string>
}

/** Today in Baku as "YYYY-MM-DD". */
export function bakuToday(now: Date = new Date()): string {
  const p = parts(now)
  return `${p.year}-${p.month}-${p.day}`
}

/** The current Baku time rounded down to a quarter hour, as "HH:mm". */
export function bakuQuarterHour(now: Date = new Date()): string {
  const p = parts(now)
  const minute = Math.floor(Number(p.minute) / 15) * 15
  return `${p.hour}:${String(minute).padStart(2, '0')}`
}
