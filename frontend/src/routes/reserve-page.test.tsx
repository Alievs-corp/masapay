import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { ReservePage } from '@/routes/reserve-page'
import { mockApi, renderWithProviders, requestsOf } from '@/test/utils'
import type {
  FloorTable,
  FloorTableState,
  ReservationView,
} from '@/features/reservations/types'

const RID = 'r1'

const info = {
  restaurantId: RID,
  restaurantName: 'Dolma',
  currency: 'AZN',
  timeZone: 'Asia/Baku',
  today: '2026-11-27',
  lastBookableDate: '2026-11-28',
  rules: {
    enabled: true,
    bookingWindowDays: 1,
    holdMinutes: 30,
    defaultDurationMinutes: 120,
    depositType: 'NONE',
    depositValue: 0,
    freeCancelHours: 2,
    lateCancelRefundPercent: 0,
    noShowRefundPercent: 0,
  },
  floors: [1, 2],
}

const table = (
  id: string,
  label: string,
  state: FloorTableState,
  floor = 1,
): FloorTable => ({
  tableId: id,
  label,
  kind: label.startsWith('C') ? ('CABIN' as const) : ('TABLE' as const),
  floor,
  zone: null,
  locationDescription: `${label} by the window`,
  seats: 4,
  x: 10,
  y: 10,
  w: 15,
  h: 15,
  state,
  fitsParty: true,
})

const floor = {
  date: '2026-11-28',
  time: '19:00',
  floors: [1],
  tables: [table('t1', 'T1', 'FREE'), table('t2', 'T2', 'RESERVED')],
}

function reservation(
  overrides: Partial<ReservationView> = {},
): ReservationView {
  return {
    id: 'res1',
    code: 'K7Q2M9XP3A',
    restaurantId: RID,
    restaurantName: 'Dolma',
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    source: 'CUSTOMER',
    startsAt: '2026-11-28T15:00:00Z',
    endsAt: '2026-11-28T17:00:00Z',
    validUntil: '2026-11-28T15:30:00Z',
    localDate: '2026-11-28',
    localTime: '19:00',
    partySize: 2,
    guestName: 'Aysel',
    guestPhone: '+99450*****67',
    note: null,
    table: { ...table('t1', 'T1', 'FREE'), tableId: 't1', label: 'T1' },
    floorTables: [],
    items: [],
    currency: 'AZN',
    itemsTotal: 0,
    depositAmount: 0,
    amountDue: 0,
    amountToPayNow: 0,
    paidAmount: 0,
    refundedAmount: 0,
    remaining: 0,
    policy: {
      holdMinutes: 30,
      freeCancelUntil: '2026-11-28T13:00:00Z',
      lateCancelRefundPercent: 0,
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
    ...overrides,
  }
}

const menu = [
  {
    id: 'c1',
    name: 'Isti',
    items: [
      {
        id: 'm1',
        name: 'Dolma',
        description: null,
        price: 12.5,
        components: [],
        imageUrl: null,
      },
      {
        id: 'm2',
        name: 'Qutab',
        description: 'Göyərti ilə',
        ingredients: 'un, göyərti, yağ',
        price: 3,
        components: [],
        imageUrl: null,
      },
    ],
  },
]

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/r/:restaurantSlug/reserve" element={<ReservePage />} />
      <Route path="/reservation/:code" element={<p>reservation page</p>} />
    </Routes>,
    { route: `/r/${RID}/reserve` },
  )
}

async function fillDetails() {
  const user = userEvent.setup()
  await screen.findByText('Dolma')
  // Tomorrow is the second date chip (today is selected).
  await user.click(screen.getAllByRole('button', { pressed: false })[0])
  await user.selectOptions(screen.getByLabelText('Saat'), '19:00')
  await user.click(await screen.findByRole('button', { name: /^T1, Boş/ }))
  expect(screen.getByText('T1 by the window')).toBeInTheDocument()
  // A reserved table cannot be picked.
  expect(
    screen.getByRole('button', { name: /^T2, Rezerv olunub/ }),
  ).toBeDisabled()
  await user.type(screen.getByLabelText('Ad'), 'Aysel')
  await user.type(screen.getByLabelText('Telefon'), '+994501234567')
  await user.click(screen.getByRole('button', { name: 'Rezervi təsdiqlə' }))
  return user
}

describe('ReservePage', () => {
  it('reserves without dishes and without paying: confirmed and unpaid', async () => {
    const fetchMock = mockApi({
      [`GET /api/public/restaurants/${RID}/reservations/info`]: info,
      [`GET /api/public/restaurants/${RID}/reservations/floor`]: floor,
      [`POST /api/public/restaurants/${RID}/reservations`]: () =>
        new Response(JSON.stringify(reservation({ amountToPayNow: 0 })), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    })
    renderPage()
    const user = await fillDetails()

    // Notes step: nothing to ask for.
    expect(await screen.findByText('Xüsusi istəklər')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'İstəyim yoxdur' }))

    expect(
      await screen.findByText('Menyudan yemək əlavə etmək istəyirsiniz?'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xeyr' }))
    await user.click(screen.getByRole('button', { name: 'Rezervə bax' }))
    expect(await screen.findByText('reservation page')).toBeInTheDocument()

    const create = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((r) => r.method === 'POST')!
    expect(await create.clone().json()).toMatchObject({
      tableId: 't1',
      date: '2026-11-28',
      time: '19:00',
      partySize: 2,
      guestName: 'Aysel',
      note: null,
      requests: {
        childSeats: 0,
        wheelchair: false,
        occasion: null,
        allergens: [],
        allergyNote: null,
      },
    })
    expect(window.localStorage.getItem('masapay.reservations')).toContain(
      'K7Q2M9XP3A',
    )
  })

  it('pre-orders a dish and pays now through the payment flow', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const withItems = reservation({
      items: [
        {
          id: 'i1',
          menuItemId: 'm1',
          name: 'Dolma',
          quantity: 2,
          unitPrice: 12.5,
          totalPrice: 25,
        },
      ],
      itemsTotal: 25,
      amountDue: 25,
      amountToPayNow: 25,
      remaining: 25,
    })
    const fetchMock = mockApi({
      [`GET /api/public/restaurants/${RID}/reservations/info`]: info,
      [`GET /api/public/restaurants/${RID}/reservations/floor`]: floor,
      [`GET /api/public/restaurants/${RID}/menu`]: menu,
      [`POST /api/public/restaurants/${RID}/reservations`]: reservation(),
      'PUT /api/public/reservations/K7Q2M9XP3A/items': withItems,
      'POST /api/public/reservations/K7Q2M9XP3A/checkout': {
        transactionId: 'tx1',
        paymentUrl: '/payment/mock?tx=tx1',
      },
    })
    renderPage()
    const user = await fillDetails()

    // Notes step: a high chair, a birthday, a gluten allergy and a note.
    await screen.findByText('Xüsusi istəklər')
    await user.click(
      screen.getByRole('button', { name: 'Uşaq oturacağını artır' }),
    )
    await user.click(screen.getByRole('button', { name: 'Ad günü' }))
    await user.click(screen.getByRole('button', { name: 'Qluten' }))
    await user.type(
      screen.getByLabelText('Allergiya haqqında qeyd'),
      'Ağır allergiya',
    )
    await user.type(screen.getByLabelText('Əlavə qeyd'), 'Pəncərə yanı')
    await user.click(screen.getByRole('button', { name: 'Davam et' }))

    await user.click(await screen.findByRole('button', { name: 'Bəli' }))

    // Allergy safety: the flour dish is flagged, the other is not.
    const qutab = (await screen.findByText('Qutab')).closest('li')!
    expect(qutab).toHaveTextContent('Tərkibində ola bilər: Qluten')
    const dolma = screen
      .getAllByText('Dolma')
      .map((el) => el.closest('li'))
      .find(Boolean)!
    expect(dolma).not.toHaveTextContent('Tərkibində ola bilər')
    expect(
      screen.getByText(/Restorana allergiyanız \(Qluten\) bildirildi/),
    ).toBeInTheDocument()

    await user.click(
      await screen.findByRole('button', { name: 'Dolma əlavə et' }),
    )
    await user.click(screen.getByRole('button', { name: 'Dolma əlavə et' }))
    await user.click(screen.getByRole('button', { name: /2 məhsul/ }))

    expect(await screen.findByText('İndi ödəyəcəksiniz?')).toBeInTheDocument()
    expect(screen.getByText('2 x Dolma')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bəli, ödə' }))

    expect(assign).toHaveBeenCalledWith('/payment/mock?tx=tx1')
    expect(requestsOf(fetchMock)).toContain(
      'PUT /api/public/reservations/K7Q2M9XP3A/items',
    )
    const create = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((r) => r.method === 'POST' && r.url.endsWith('/reservations'))!
    expect(await create.clone().json()).toMatchObject({
      note: 'Pəncərə yanı',
      requests: {
        childSeats: 1,
        wheelchair: false,
        occasion: 'BIRTHDAY',
        allergens: ['GLUTEN'],
        allergyNote: 'Ağır allergiya',
      },
    })
    vi.unstubAllGlobals()
  })
})
