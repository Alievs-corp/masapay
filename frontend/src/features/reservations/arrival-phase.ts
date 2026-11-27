import { useEffect, useState } from 'react'
import type { ReservationView } from './types'

// What /reservation/:code shows (spec 11.3), from the server instants:
//   UPCOMING - confirmed, before the start: countdown, details, notes editor;
//   ARRIVAL  - confirmed from the start until the hold ends, or seated: the
//              table information view opens directly;
//   ENDED    - finished, cancelled, no-show, or confirmed past the hold.

export type ArrivalPhase = 'UPCOMING' | 'ARRIVAL' | 'ENDED'

type Timing = Pick<ReservationView, 'status' | 'startsAt' | 'validUntil'>

export function arrivalPhase(r: Timing, now: number): ArrivalPhase {
  if (r.status === 'SEATED') return 'ARRIVAL'
  if (r.status !== 'CONFIRMED') return 'ENDED'
  const start = Date.parse(r.startsAt)
  const end = Date.parse(r.validUntil)
  if (Number.isNaN(start)) return 'UPCOMING'
  if (now < start) return 'UPCOMING'
  if (Number.isNaN(end) || now < end) return 'ARRIVAL'
  return 'ENDED'
}

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Whole time left until `target` (never negative). */
export function countdownTo(target: string, now: number): Countdown {
  const ms = Math.max(Date.parse(target) - now, 0) || 0
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

// Timers longer than this overflow setTimeout.
const MAX_DELAY = 2 ** 31 - 1

/**
 * The phase plus the current time, re-rendering every second while the
 * countdown runs and exactly at the start / hold-end boundaries. `skewMs` is
 * server time minus device time (from ReservationView.serverNow), so a phone
 * with a wrong clock still opens the table view at the real start time.
 */
export function useArrivalPhase(
  r: Timing | undefined,
  skewMs = 0,
): {
  phase: ArrivalPhase
  now: number
} {
  const [deviceNow, setNow] = useState(() => Date.now())
  const now = deviceNow + skewMs
  const phase = r ? arrivalPhase(r, now) : 'UPCOMING'
  const start = r ? Date.parse(r.startsAt) : NaN
  const end = r ? Date.parse(r.validUntil) : NaN

  useEffect(() => {
    if (!r) return
    let delay: number | null = null
    if (phase === 'UPCOMING' && !Number.isNaN(start)) {
      // Tick each second for the countdown, but never past the start.
      delay = Math.min(1000, Math.max(start - (Date.now() + skewMs), 0))
    } else if (
      phase === 'ARRIVAL' &&
      r.status === 'CONFIRMED' &&
      !Number.isNaN(end)
    ) {
      delay = Math.max(end - (Date.now() + skewMs), 0)
    }
    if (delay === null) return
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, MAX_DELAY),
    )
    return () => clearTimeout(timer)
  }, [r, phase, start, end, deviceNow, skewMs])

  return { phase, now }
}
