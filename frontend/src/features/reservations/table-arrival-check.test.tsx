import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderWithProviders } from '@/test/utils'
import { TableArrivalCheck } from './table-arrival-check'
import { STORED_RESERVATIONS_KEY } from './stored-reservation-codes'

const view = (status: 'CONFIRMED' | 'SEATED') => ({
  id: 'res-1',
  code: 'ABC123',
  status,
  startsAt: '2026-11-27T15:00:00Z',
  validUntil: '2026-11-27T15:30:00Z',
  currency: 'AZN',
  paidAmount: 9,
  remaining: 0,
  note: null,
  requests: {
    childSeats: 0,
    wheelchair: false,
    occasion: null,
    allergens: ['GLUTEN'],
    allergyNote: null,
  },
  table: {
    tableId: 't5',
    label: 'T5',
    kind: 'TABLE',
    floor: 1,
    zone: null,
    locationDescription: 'Pəncərənin yanında',
    seats: 4,
    x: 5,
    y: 5,
    w: 10,
    h: 10,
  },
  floorTables: [],
  items: [
    {
      id: 'i1',
      menuItemId: 'm1',
      name: 'Plov',
      quantity: 1,
      unitPrice: 9,
      totalPrice: 9,
    },
  ],
})

describe('TableArrivalCheck (QR scan of the reserved table)', () => {
  afterEach(() => window.localStorage.clear())

  it('shows the modal for a stored code and checks the guest in', async () => {
    window.localStorage.setItem(
      STORED_RESERVATIONS_KEY,
      JSON.stringify(['ABC123']),
    )
    mockApi({
      'GET /api/public/tables/q1/reservation': view('CONFIRMED'),
      'POST /api/public/tables/q1/reservation/check-in': view('SEATED'),
    })
    renderWithProviders(<TableArrivalCheck qrToken="q1" />)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Bu restoranda rezerviniz var')
    expect(dialog).toHaveTextContent('Masa T5')
    expect(dialog).toHaveTextContent('Plov')
    expect(dialog).toHaveTextContent('Pəncərənin yanında')
    // The full table information view comes first: money and the allergy too.
    expect(dialog).toHaveTextContent(/Ödənilib\s*9,00/)
    expect(dialog).toHaveTextContent('Allergiya: Qluten')

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Gəldim, masaya otururam/ }))
    expect(await screen.findByText(/Masaya oturdunuz/)).toBeInTheDocument()
  })

  it('also probes a reservation code passed in the link', async () => {
    const fetchMock = mockApi({
      'GET /api/public/tables/q1/reservation': view('CONFIRMED'),
    })
    renderWithProviders(<TableArrivalCheck qrToken="q1" extraCode="abc123" />)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Masa T5')
    const url = new URL((fetchMock.mock.calls[0][0] as Request).url)
    expect(url.searchParams.get('code')).toBe('ABC123')
  })

  it('stays silent when the server answers 204 (other table or outside the window)', async () => {
    window.localStorage.setItem(
      STORED_RESERVATIONS_KEY,
      JSON.stringify(['ABC123']),
    )
    mockApi({
      'GET /api/public/tables/q1/reservation': () =>
        new Response(null, { status: 204 }),
    })
    renderWithProviders(<TableArrivalCheck qrToken="q1" />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
