import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded } from '@/features/auth/auth-slice'
import { TablesPage } from '@/routes/admin/tables-page'
import { mockApi, renderWithProviders } from '@/test/utils'
import { ReservationRulesSection } from './reservation-rules-section'
import { draftOf, parseLocation } from './table-location'

const table = {
  id: 't1',
  label: 'C5',
  status: 'AVAILABLE',
  qrToken: 'q1',
  customerUrl: 'http://localhost:5173/r/r1/t/t1?token=q1',
  serviceChargePercent: null,
  effectiveServiceChargePercent: null,
  kind: 'CABIN',
  floor: 2,
  zone: 'Right side',
  locationDescription: '2nd floor, right side, cabin 5',
  seats: 6,
  x: 10,
  y: 20,
  w: 12,
  h: 8,
}

const rules = {
  enabled: true,
  bookingWindowDays: 1,
  holdMinutes: 30,
  defaultDurationMinutes: 120,
  depositType: 'NONE',
  depositValue: 0,
  freeCancelHours: 2,
  lateCancelRefundPercent: 0,
  noShowRefundPercent: 0,
}

describe('parseLocation', () => {
  const base = draftOf({
    kind: 'TABLE',
    floor: 1,
    zone: null,
    locationDescription: null,
    seats: 4,
    x: 0,
    y: 0,
    w: 10,
    h: 10,
  })

  it('accepts a box inside the grid and trims empty texts to null', () => {
    expect(parseLocation({ ...base, zone: '  ' })).toMatchObject({
      floor: 1,
      zone: null,
      w: 10,
    })
  })

  it('rejects a box that leaves the 0-100 grid or zero seats', () => {
    expect(parseLocation({ ...base, x: '95', w: '10' })).toBeNull()
    expect(parseLocation({ ...base, seats: '0' })).toBeNull()
    expect(parseLocation({ ...base, floor: '1.5' })).toBeNull()
  })
})

describe('table location dialog', () => {
  it('shows the location on the card and saves an edited location', async () => {
    store.dispatch(
      userLoaded({ id: 'u1', email: 'm@x.az', role: 'RESTO_MANAGER' }),
    )
    let sent: unknown = null
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/tables': [table],
      'GET /api/admin/tables/t1/qr':
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      'PUT /api/admin/restaurants/r1/tables/t1/location': async (
        request: Request,
      ) => {
        sent = await request.json()
        return table
      },
    })
    renderWithProviders(<TablesPage />)

    expect(
      await screen.findByText('Kabina, 2-ci mərtəbə, 6 yer'),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'C5 masasının yeri' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Masanın yeri' })
    expect(within(dialog).getByTestId('location-preview-current')).toHaveStyle({
      left: '10%',
      width: '12%',
    })

    const seats = within(dialog).getByLabelText('Yer sayı')
    await userEvent.clear(seats)
    await userEvent.type(seats, '8')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Yadda saxla' }),
    )

    await waitFor(() =>
      expect(sent).toEqual({
        kind: 'CABIN',
        floor: 2,
        zone: 'Right side',
        locationDescription: '2nd floor, right side, cabin 5',
        seats: 8,
        x: 10,
        y: 20,
        w: 12,
        h: 8,
      }),
    )
  })

  it('hides the location button from waiters', async () => {
    store.dispatch(userLoaded({ id: 'u2', email: 'w@x.az', role: 'WAITER' }))
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/tables': [table],
      'GET /api/admin/tables/t1/qr':
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    renderWithProviders(<TablesPage />)

    expect(
      await screen.findByText('Kabina, 2-ci mərtəbə, 6 yer'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'C5 masasının yeri' }),
    ).not.toBeInTheDocument()
  })
})

describe('ReservationRulesSection', () => {
  it('saves a percent deposit and refund rules', async () => {
    let sent: unknown = null
    mockApi({
      'GET /api/admin/restaurants/r1/reservation-rules': rules,
      'PUT /api/admin/restaurants/r1/reservation-rules': async (
        request: Request,
      ) => {
        sent = await request.json()
        return sent
      },
    })
    renderWithProviders(<ReservationRulesSection restaurantId="r1" />)

    const bookingWindow = await screen.findByLabelText(
      'Neçə gün əvvəl rezerv (gün)',
    )
    expect(bookingWindow).toHaveValue('1')
    await userEvent.click(
      screen.getByRole('radio', { name: 'Sifarişin faizi' }),
    )
    await userEvent.clear(screen.getByLabelText('İlkin ödəniş dəyəri'))
    await userEvent.type(screen.getByLabelText('İlkin ödəniş dəyəri'), '50')
    const noShow = screen.getByLabelText('Gəlməmədə qaytarılan (%)')
    await userEvent.clear(noShow)
    await userEvent.type(noShow, '25')
    await userEvent.click(screen.getByRole('button', { name: 'Yadda saxla' }))

    await waitFor(() =>
      expect(sent).toEqual({
        ...rules,
        depositType: 'PERCENT',
        depositValue: 50,
        noShowRefundPercent: 25,
      }),
    )
    expect(await screen.findByText('Yadda saxlanıldı.')).toBeInTheDocument()
  })

  it('blocks saving a refund percent above 100', async () => {
    mockApi({ 'GET /api/admin/restaurants/r1/reservation-rules': rules })
    renderWithProviders(<ReservationRulesSection restaurantId="r1" />)

    const late = await screen.findByLabelText('Gec ləğvdə qaytarılan (%)')
    await userEvent.clear(late)
    await userEvent.type(late, '150')

    expect(screen.getByRole('button', { name: 'Yadda saxla' })).toBeDisabled()
  })
})
