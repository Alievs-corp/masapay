import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded } from '@/features/auth/auth-slice'
import { availableActions } from '@/features/admin/reservations/reservation-actions'
import { ReservationsPage } from '@/routes/admin/reservations-page'
import { mockApi, requestsOf, renderWithProviders } from '@/test/utils'

const table = {
  tableId: 't1',
  label: 'Kabinə 5',
  kind: 'CABIN',
  floor: 2,
  zone: 'right',
  locationDescription: '2-ci mərtəbə, sağ tərəf',
  seats: 4,
  x: 10,
  y: 10,
  w: 20,
  h: 20,
}

const reservation = {
  id: 'res1',
  code: 'AB12CD',
  restaurantId: 'r1',
  restaurantName: 'Dolma',
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  source: 'STAFF',
  startsAt: '2026-11-27T15:00:00Z',
  endsAt: '2026-11-27T17:00:00Z',
  validUntil: '2026-11-27T15:30:00Z',
  localDate: '2026-11-27',
  localTime: '19:00',
  partySize: 3,
  guestName: 'Aysel',
  guestPhone: '+994501234567',
  note: null,
  table,
  floorTables: [],
  items: [
    {
      id: 'i1',
      menuItemId: 'm1',
      name: 'Dolma',
      quantity: 2,
      unitPrice: 6,
      totalPrice: 12,
    },
  ],
  currency: 'AZN',
  itemsTotal: 12,
  depositAmount: 0,
  amountDue: 12,
  amountToPayNow: 0,
  paidAmount: 0,
  refundedAmount: 0,
  remaining: 12,
  policy: {
    holdMinutes: 30,
    freeCancelUntil: '2026-11-27T13:00:00Z',
    lateCancelRefundPercent: 50,
    noShowRefundPercent: 0,
    depositType: 'NONE',
    depositValue: 0,
  },
  canCancel: true,
  canPay: true,
  canEditItems: true,
  seatedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-11-27T10:00:00Z',
}

const floor = {
  date: '2026-11-27',
  time: '19:00',
  floors: [2],
  tables: [
    { ...table, state: 'RESERVED', fitsParty: true, reservationId: 'res1' },
  ],
}

describe('ReservationsPage', () => {
  beforeEach(() => {
    store.dispatch(userLoaded({ id: 'w1', email: 'w@x.az', role: 'WAITER' }))
  })

  it('lists the day, marks unpaid with the amount due and seats from the detail', async () => {
    const fetchMock = mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/reservations': [reservation],
      'GET /api/admin/restaurants/r1/reservations/floor': floor,
      'POST /api/admin/restaurants/r1/reservations/res1/seat': {
        ...reservation,
        status: 'SEATED',
      },
    })
    renderWithProviders(<ReservationsPage />)

    const list = await screen.findByRole('region', { name: 'Rezervlər' })
    const row = await within(list).findByRole('button', { name: /Aysel/ })
    expect(within(row).getByText('ÖDƏNİLMƏYİB')).toBeInTheDocument()
    expect(within(row).getByText(/Ödəniləcək məbləğ/)).toBeInTheDocument()

    await userEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('+994501234567')).toBeInTheDocument()
    expect(within(dialog).getByText('2 x Dolma')).toBeInTheDocument()
    expect(
      within(dialog).getByText('2-ci mərtəbə, sağ tərəf'),
    ).toBeInTheDocument()

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Oturdu' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Təsdiqlə' }),
    )
    await screen.findByRole('region', { name: 'Rezervlər' })
    expect(requestsOf(fetchMock)).toContain(
      'POST /api/admin/restaurants/r1/reservations/res1/seat',
    )
  })

  it('sends a staff booking for the chosen date', async () => {
    const fetchMock = mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/reservations': [],
      'GET /api/admin/restaurants/r1/reservations/floor': {
        ...floor,
        tables: [{ ...floor.tables[0], state: 'FREE', reservationId: null }],
      },
      'POST /api/admin/restaurants/r1/reservations': reservation,
    })
    renderWithProviders(<ReservationsPage />)
    await screen.findByText('Bu gün üçün rezerv yoxdur.')
    const create = screen.getByRole('button', { name: 'Yeni rezerv' })
    await vi.waitFor(() => expect(create).toBeEnabled())
    await userEvent.click(create)

    const dialog = await screen.findByRole('dialog')
    const date = within(dialog).getByLabelText('Tarix')
    await userEvent.clear(date)
    await userEvent.type(date, '2027-01-15')
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Rauf')
    await userEvent.type(
      within(dialog).getByLabelText('Telefon'),
      '+994551112233',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Rezerv et' }),
    )

    await vi.waitFor(() =>
      expect(requestsOf(fetchMock)).toContain(
        'POST /api/admin/restaurants/r1/reservations',
      ),
    )
    const post = fetchMock.mock.calls
      .map(([input, init]) =>
        input instanceof Request ? input : new Request(input, init),
      )
      .find((request) => request.method === 'POST')!
    const body = await post.clone().json()
    expect(body).toMatchObject({
      tableId: 't1',
      date: '2027-01-15',
      guestName: 'Rauf',
      guestPhone: '+994551112233',
      partySize: 2,
    })
  })

  it('offers only the actions the status allows', () => {
    expect(availableActions({ status: 'CONFIRMED' })).toEqual([
      'seat',
      'cancel',
      'noShow',
    ])
    expect(availableActions({ status: 'SEATED' })).toEqual(['complete'])
    expect(availableActions({ status: 'CANCELLED' })).toEqual([])
  })
})
