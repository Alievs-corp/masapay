import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { arrivalPhase, countdownTo, useArrivalPhase } from './arrival-phase'
import type { ReservationStatus } from './types'

const start = '2026-11-27T15:00:00Z'
const until = '2026-11-27T15:30:00Z'
const at = (iso: string) => Date.parse(iso)
const r = (status: ReservationStatus = 'CONFIRMED') => ({
  status,
  startsAt: start,
  validUntil: until,
})

describe('arrivalPhase (what /reservation/:code shows)', () => {
  it('is UPCOMING before the start time', () => {
    expect(arrivalPhase(r(), at('2026-11-27T14:59:59Z'))).toBe('UPCOMING')
  })

  it('is ARRIVAL from the start time until the hold ends', () => {
    expect(arrivalPhase(r(), at(start))).toBe('ARRIVAL')
    expect(arrivalPhase(r(), at('2026-11-27T15:29:59Z'))).toBe('ARRIVAL')
  })

  it('is ENDED once the hold is over for an unseated booking', () => {
    expect(arrivalPhase(r(), at(until))).toBe('ENDED')
    expect(arrivalPhase(r(), at('2026-11-27T18:00:00Z'))).toBe('ENDED')
  })

  it('keeps the table view while the guest is seated, even after the hold', () => {
    expect(arrivalPhase(r('SEATED'), at('2026-11-27T16:30:00Z'))).toBe(
      'ARRIVAL',
    )
  })

  it('is ENDED for finished, cancelled and no-show bookings at any time', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(arrivalPhase(r(status), at('2026-11-27T14:00:00Z'))).toBe('ENDED')
      expect(arrivalPhase(r(status), at('2026-11-27T15:10:00Z'))).toBe('ENDED')
    }
  })
})

describe('countdownTo', () => {
  it('splits the time left into days, hours, minutes and seconds', () => {
    expect(countdownTo(start, at('2026-11-26T13:58:55Z'))).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 5,
    })
  })

  it('never goes below zero', () => {
    expect(countdownTo(start, at('2026-11-27T16:00:00Z'))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    })
  })
})

describe('useArrivalPhase (flips by itself while the page is open)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2026-11-27T14:59:58Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('goes UPCOMING -> ARRIVAL at the start and ARRIVAL -> ENDED at the hold end', () => {
    const booking = r()
    const { result } = renderHook(() => useArrivalPhase(booking))
    expect(result.current.phase).toBe('UPCOMING')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // Countdown ticks each second.
    expect(result.current.phase).toBe('UPCOMING')
    expect(countdownTo(start, result.current.now).seconds).toBe(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.phase).toBe('ARRIVAL')

    act(() => {
      vi.advanceTimersByTime(30 * 60_000)
    })
    expect(result.current.phase).toBe('ENDED')
  })

  it('follows the server clock when the phone clock is behind', () => {
    const booking = r()
    // Device says 14:59:58, the server is 5 minutes ahead: already started.
    const { result } = renderHook(() => useArrivalPhase(booking, 5 * 60_000))
    expect(result.current.phase).toBe('ARRIVAL')
  })
})
