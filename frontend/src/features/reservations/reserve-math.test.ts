import { describe, expect, it } from 'vitest'
import {
  bookableDates,
  isDateBookable,
  previewTotals,
  timeSlots,
} from './reserve-math'

describe('bookableDates', () => {
  it('offers today and tomorrow for a one-day window', () => {
    expect(bookableDates('2026-11-27', '2026-11-28')).toEqual([
      '2026-11-27',
      '2026-11-28',
    ])
  })

  it('crosses a month end', () => {
    expect(bookableDates('2026-11-30', '2026-12-02')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ])
  })

  it('rejects dates outside the window', () => {
    expect(isDateBookable('2026-11-29', '2026-11-27', '2026-11-28')).toBe(false)
    expect(isDateBookable('2026-11-26', '2026-11-27', '2026-11-28')).toBe(false)
    expect(isDateBookable('2026-11-28', '2026-11-27', '2026-11-28')).toBe(true)
  })
})

describe('timeSlots', () => {
  it('hides past times today', () => {
    const slots = timeSlots(true, '18:10')
    expect(slots[0]).toBe('18:30')
    expect(slots).not.toContain('18:00')
  })

  it('offers the whole day for a later date', () => {
    expect(timeSlots(false, '18:10')).toHaveLength(48)
  })
})

describe('previewTotals', () => {
  const lines = [
    { unitPrice: 1250, quantity: 2 },
    { unitPrice: 333, quantity: 3 },
  ]

  it('pays the items now when there is no deposit', () => {
    expect(
      previewTotals(lines, { depositType: 'NONE', depositValue: 0 }),
    ).toEqual({
      itemsTotal: 3499,
      deposit: 0,
      amountDue: 3499,
      payNow: 3499,
      remaining: 0,
    })
  })

  it('pays a percent deposit now, rounded half up', () => {
    // 10 % of 34.99 = 3.499 -> 3.50
    expect(
      previewTotals(lines, { depositType: 'PERCENT', depositValue: 10 }),
    ).toEqual({
      itemsTotal: 3499,
      deposit: 350,
      amountDue: 3499,
      payNow: 350,
      remaining: 3149,
    })
  })

  it('a fixed deposit above the items is the amount due', () => {
    expect(
      previewTotals([], { depositType: 'FIXED', depositValue: 20 }),
    ).toEqual({
      itemsTotal: 0,
      deposit: 2000,
      amountDue: 2000,
      payNow: 2000,
      remaining: 0,
    })
  })
})
