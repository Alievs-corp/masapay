import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded, type UserRole } from '@/features/auth/auth-slice'
import { staffRequests } from '@/features/admin/reservations/guest-requests-model'
import { toTickets } from '@/features/admin/kitchen/tickets'
import { KitchenPage } from '@/routes/admin/kitchen-page'
import { ReservationsPage } from '@/routes/admin/reservations-page'
import { mockApi, requestsOf, renderWithProviders } from '@/test/utils'

// Guest requests and allergies on the staff screens (spec section 11).

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
  paymentStatus: 'PAID',
  source: 'CUSTOMER',
  startsAt: '2026-11-27T15:00:00Z',
  endsAt: '2026-11-27T17:00:00Z',
  validUntil: '2026-11-27T15:30:00Z',
  localDate: '2026-11-27',
  localTime: '19:00',
  partySize: 3,
  guestName: 'Aysel',
  guestPhone: '+994501234567',
  note: 'Pəncərə kənarı olsa yaxşı olar',
  table,
  floorTables: [],
  items: [],
  currency: 'AZN',
  itemsTotal: 20,
  depositAmount: 0,
  amountDue: 20,
  amountToPayNow: 0,
  paidAmount: 20,
  refundedAmount: 0,
  remaining: 0,
  policy: {
    holdMinutes: 30,
    freeCancelUntil: '2026-11-27T13:00:00Z',
    lateCancelRefundPercent: 50,
    noShowRefundPercent: 0,
    depositType: 'NONE',
    depositValue: 0,
  },
  canCancel: true,
  canPay: false,
  canEditItems: false,
  seatedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-11-27T10:00:00Z',
  requests: {
    childSeats: 1,
    wheelchair: true,
    wheelchairAccess: true,
    occasion: 'BIRTHDAY',
    allergens: ['NUTS', 'MILK'],
    allergies: ['NUTS', 'MILK'],
    allergyNote: 'Çox ağır, iz belə olmasın',
  },
}

const floor = {
  date: '2026-11-27',
  time: '19:00',
  floors: [2],
  tables: [
    { ...table, state: 'RESERVED', fitsParty: true, reservationId: 'res1' },
  ],
}

function login(role: UserRole) {
  store.dispatch(userLoaded({ id: 'u1', email: 'u@x.az', role }))
}

describe('staff requests', () => {
  it('reads either spelling the server sends', () => {
    expect(
      staffRequests({
        requests: {
          childSeats: 2,
          wheelchairAccess: true,
          occasion: null,
          allergies: ['EGGS', 'EGGS'],
          allergyNote: '  ',
        } as never,
      }),
    ).toEqual({
      childSeats: 2,
      wheelchair: true,
      occasion: null,
      allergens: ['EGGS'],
      allergyNote: null,
    })
    expect(staffRequests({ requests: null })).toMatchObject({
      allergens: [],
      childSeats: 0,
      wheelchair: false,
    })
  })

  it('puts the allergy of any line on the kitchen ticket', () => {
    const [ticket] = toTickets([
      {
        id: 'l1',
        tableId: 't1',
        tableLabel: 'T1',
        name: 'Dolma',
        quantity: 1,
        status: 'NEW',
        orderedAt: '2026-11-27T15:10:00Z',
        allergies: [],
        allergyNote: null,
      },
      {
        id: 'l2',
        tableId: 't1',
        tableLabel: 'T1',
        name: 'Paxlava',
        quantity: 1,
        status: 'NEW',
        orderedAt: '2026-11-27T15:05:00Z',
        allergies: ['NUTS'],
        allergyNote: 'ağır',
      },
    ])
    expect(ticket.allergies).toEqual(['NUTS'])
    expect(ticket.allergyNote).toBe('ağır')
  })
})

describe('ReservationsPage guest requests', () => {
  beforeEach(() => login('WAITER'))

  it('shows the allergy in the list, on the floor tile and in the detail', async () => {
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/reservations': [reservation],
      'GET /api/admin/restaurants/r1/reservations/floor': floor,
    })
    renderWithProviders(<ReservationsPage />)

    const list = await screen.findByRole('region', { name: 'Rezervlər' })
    const row = await within(list).findByRole('button', { name: /Aysel/ })
    expect(
      within(row).getByText('Allergiya: Qoz-fındıq, Süd / laktoza'),
    ).toBeInTheDocument()
    expect(within(row).getByText('Uşaq oturacağı: 1')).toBeInTheDocument()

    expect(await screen.findByTestId('allergy-marker-t1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Kabinə 5: allergiya var/ }),
    ).toBeInTheDocument()

    await userEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    const warning = within(dialog).getByRole('alert')
    expect(warning).toHaveTextContent('ALLERGİYA')
    expect(warning).toHaveTextContent('Qoz-fındıq, Süd / laktoza')
    expect(warning).toHaveTextContent('Çox ağır, iz belə olmasın')
    expect(within(dialog).getByText('Ad günü')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Əlil arabası üçün yer'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Pəncərə kənarı olsa yaxşı olar'),
    ).toBeInTheDocument()
  })

  it('lets a waiter mark a no-show and warns when the refund failed', async () => {
    const fetchMock = mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/reservations': [reservation],
      'GET /api/admin/restaurants/r1/reservations/floor': floor,
      'POST /api/admin/restaurants/r1/reservations/res1/no-show': {
        ...reservation,
        status: 'NO_SHOW',
        refundError: 'REFUND_FAILED',
      },
    })
    renderWithProviders(<ReservationsPage />)
    const list = await screen.findByRole('region', { name: 'Rezervlər' })
    await userEvent.click(
      await within(list).findByRole('button', { name: /Aysel/ }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: 'Oturdu' }),
    ).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Gəlmədi' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Təsdiqlə' }),
    )
    expect(
      await screen.findByText(/geri qaytarmaq alınmadı/),
    ).toBeInTheDocument()
    expect(requestsOf(fetchMock)).toContain(
      'POST /api/admin/restaurants/r1/reservations/res1/no-show',
    )
  })
})

describe('KitchenPage allergy', () => {
  const line = {
    id: 'l1',
    tableId: 't1',
    tableLabel: 'Kabinə 5',
    name: 'Paxlava',
    quantity: 1,
    status: 'NEW',
    orderedAt: '2026-11-27T15:10:00Z',
  }

  it('shows the allergy the kitchen endpoint sends to a chef', async () => {
    login('CHEF')
    const fetchMock = mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/kitchen': [
        { ...line, allergies: ['NUTS'], allergyNote: null },
      ],
    })
    renderWithProviders(<KitchenPage />)
    const ticket = await screen.findByRole('region', { name: 'Kabinə 5' })
    expect(within(ticket).getByRole('alert')).toHaveTextContent(
      'ALLERGİYAQoz-fındıq',
    )
    // A chef never calls the staff reservations API.
    expect(requestsOf(fetchMock).some((r) => r.includes('/reservations'))).toBe(
      false,
    )
  })

  it('falls back to the seated reservation for a manager', async () => {
    login('RESTO_MANAGER')
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/kitchen': [line],
      'GET /api/admin/restaurants/r1/reservations': [
        { ...reservation, status: 'SEATED' },
      ],
    })
    renderWithProviders(<KitchenPage />)
    const ticket = await screen.findByRole('region', { name: 'Kabinə 5' })
    await vi.waitFor(() =>
      expect(within(ticket).getByRole('alert')).toHaveTextContent(
        'Süd / laktoza',
      ),
    )
  })
})

describe('staff phone booking with requests', () => {
  beforeEach(() => login('WAITER'))

  it('sends the allergy a waiter picks with the booking', async () => {
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
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Rauf')
    await userEvent.type(
      within(dialog).getByLabelText('Telefon'),
      '+994551112233',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Qoz-fındıq' }),
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
    expect(body.requests.allergens).toEqual(['NUTS'])
  })
})
