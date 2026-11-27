import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { ReservationPage } from '@/routes/reservation-page'
import { mockApi, renderWithProviders, requestsOf } from '@/test/utils'
import type { ReservationView } from '@/features/reservations/types'

const table = {
  tableId: 't5',
  label: 'C5',
  kind: 'CABIN' as const,
  floor: 2,
  zone: 'Sağ tərəf',
  locationDescription: '2-ci mərtəbə, sağ tərəf, kabin 5',
  seats: 6,
  x: 10,
  y: 20,
  w: 12,
  h: 8,
}

function reservation(over: Partial<ReservationView> = {}): ReservationView {
  return {
    id: 'res-1',
    code: 'K7Q2M9XP3A',
    restaurantId: 'r1',
    restaurantName: 'Dolma House',
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    source: 'CUSTOMER',
    startsAt: '2099-01-01T15:00:00Z',
    endsAt: '2099-01-01T17:00:00Z',
    validUntil: '2099-01-01T15:30:00Z',
    localDate: '2099-01-01',
    localTime: '19:00',
    partySize: 4,
    guestName: 'Aysel',
    guestPhone: '+99450*****67',
    note: null,
    table,
    floorTables: [{ ...table, state: 'RESERVED', fitsParty: true }],
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
    currency: 'AZN',
    itemsTotal: 25,
    depositAmount: 10,
    amountDue: 25,
    amountToPayNow: 10,
    paidAmount: 0,
    refundedAmount: 0,
    remaining: 25,
    policy: {
      holdMinutes: 30,
      freeCancelUntil: '2099-01-01T13:00:00Z',
      lateCancelRefundPercent: 50,
      noShowRefundPercent: 0,
      depositType: 'FIXED',
      depositValue: 10,
    },
    canCancel: true,
    canPay: true,
    canEditItems: true,
    seatedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: '2098-12-31T10:00:00Z',
    ...over,
  }
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/reservation/:code" element={<ReservationPage />} />
    </Routes>,
    { route: '/reservation/K7Q2M9XP3A' },
  )
}

describe('ReservationPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the details, unpaid state, pay buttons and policy', async () => {
    mockApi({ 'GET /api/public/reservations/K7Q2M9XP3A': reservation() })
    renderPage()

    expect(await screen.findByText('Dolma House')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(
      screen.getByText('2-ci mərtəbə, sağ tərəf, kabin 5'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Ödənilməyib').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /İndi ödə/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Hamısını ödə/ }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('mini-floor-highlight')).toHaveTextContent('C5')
    expect(
      screen.getByText(/30 dəqiqə sonraya qədər qüvvədədir/),
    ).toBeInTheDocument()
    // Not started yet: countdown, no table view.
    expect(screen.getByRole('timer')).toHaveTextContent('Rezervə qalıb')
    expect(screen.queryByTestId('arrival-view')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the table information view directly once the start time has arrived', async () => {
    const now = Date.now()
    mockApi({
      'GET /api/public/reservations/K7Q2M9XP3A': reservation({
        startsAt: new Date(now - 60_000).toISOString(),
        validUntil: new Date(now + 29 * 60_000).toISOString(),
        paidAmount: 10,
        remaining: 15,
        paymentStatus: 'PARTIALLY_PAID',
        amountToPayNow: 15,
        canEditItems: false,
        note: 'Pəncərə yanı',
        requests: {
          childSeats: 1,
          wheelchair: true,
          occasion: 'BIRTHDAY',
          allergens: ['NUTS'],
          allergyNote: 'Ağır',
        },
        canEditNotes: false,
      }),
    })
    renderPage()

    // No click needed: the view is on the page, not behind a button or dialog.
    const view = await screen.findByTestId('arrival-view')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(view).toHaveTextContent('Masanız hazırdır')
    expect(view).toHaveTextContent('Kabin C5')
    expect(view).toHaveTextContent('Mərtəbə 2')
    expect(view).toHaveTextContent('2-ci mərtəbə, sağ tərəf, kabin 5')
    expect(view).toHaveTextContent('Dolma')
    expect(within(view).getByTestId('mini-floor-highlight')).toHaveTextContent(
      'C5',
    )
    expect(view).toHaveTextContent('Allergiya: Qoz-fındıq')
    expect(view).toHaveTextContent('1 uşaq oturacağı')
    expect(view).toHaveTextContent('Pəncərə yanı')
    expect(view).toHaveTextContent(/Ödənilib\s*10,00/)
    expect(view).toHaveTextContent(/Qalıq\s*15,00/)
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('shows only the status once the hold time is over', async () => {
    const now = Date.now()
    mockApi({
      'GET /api/public/reservations/K7Q2M9XP3A': reservation({
        startsAt: new Date(now - 60 * 60_000).toISOString(),
        validUntil: new Date(now - 30 * 60_000).toISOString(),
        canPay: false,
        canCancel: false,
      }),
    })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Rezerv bitib')
    expect(screen.getByText('Rezerv müddəti başa çatıb.')).toBeInTheDocument()
    expect(screen.queryByTestId('arrival-view')).toBeNull()
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('charges the server amount after a partial payment (no double subtraction)', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    // 30 % deposit of 50 = 15 already paid; the server now offers the rest.
    const fetchMock = mockApi({
      'GET /api/public/reservations/K7Q2M9XP3A': reservation({
        itemsTotal: 50,
        depositAmount: 15,
        amountDue: 50,
        paidAmount: 15,
        remaining: 35,
        amountToPayNow: 35,
        paymentStatus: 'PARTIALLY_PAID',
      }),
      'POST /api/public/reservations/K7Q2M9XP3A/checkout': {
        transactionId: 'tx2',
        paymentUrl: '/payment/mock?tx=tx2',
      },
    })
    renderPage()
    const user = userEvent.setup()

    const payNow = await screen.findByRole('button', { name: /İndi ödə/ })
    expect(payNow).toHaveTextContent('35,00')
    // Pay now already covers everything: no second "pay all" button.
    expect(screen.queryByRole('button', { name: /Hamısını ödə/ })).toBeNull()
    await user.click(payNow)

    const checkout = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((r) => r.url.endsWith('/checkout'))!
    expect(await checkout.clone().json()).toEqual({ payFull: true })
    expect(assign).toHaveBeenCalledWith('/payment/mock?tx=tx2')
    vi.unstubAllGlobals()
  })

  it('lets the guest edit the notes before the start time', async () => {
    const saved = reservation({
      note: 'Sakit yer',
      requests: {
        childSeats: 0,
        wheelchair: true,
        occasion: null,
        allergens: ['MILK'],
        allergyNote: null,
      },
      canEditNotes: true,
    })
    const fetchMock = mockApi({
      'GET /api/public/reservations/K7Q2M9XP3A': reservation({
        canEditNotes: true,
      }),
      'PUT /api/public/reservations/K7Q2M9XP3A/notes': saved,
    })
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Xüsusi istək yoxdur')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dəyiş' }))
    await user.click(
      screen.getByRole('button', { name: 'Əlil arabası üçün yer lazımdır' }),
    )
    await user.click(screen.getByRole('button', { name: 'Süd / laktoza' }))
    await user.type(screen.getByLabelText('Əlavə qeyd'), 'Sakit yer')
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))

    expect(await screen.findByText('Yadda saxlanıldı')).toBeInTheDocument()
    expect(requestsOf(fetchMock)).toContain(
      'PUT /api/public/reservations/K7Q2M9XP3A/notes',
    )
    const put = fetchMock.mock.calls
      .map(([input]) => input as Request)
      .find((r) => r.method === 'PUT')!
    expect(await put.clone().json()).toEqual({
      note: 'Sakit yer',
      requests: {
        childSeats: 0,
        wheelchair: true,
        occasion: null,
        allergens: ['MILK'],
        allergyNote: null,
      },
    })
  })

  it('hides the notes editor once the reservation may no longer be edited', async () => {
    mockApi({
      'GET /api/public/reservations/K7Q2M9XP3A': reservation({
        canEditNotes: false,
      }),
    })
    renderPage()
    expect(await screen.findByText('Xüsusi istək yoxdur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dəyiş' })).toBeNull()
  })

  it('says so when the code is unknown', async () => {
    mockApi({})
    renderPage()
    expect(await screen.findByText('Rezerv tapılmadı')).toBeInTheDocument()
  })
})
