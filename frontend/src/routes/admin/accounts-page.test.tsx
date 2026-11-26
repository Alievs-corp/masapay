import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded } from '@/features/auth/auth-slice'
import { AccountsPage } from '@/routes/admin/accounts-page'
import { mockApi, renderWithProviders } from '@/test/utils'

const accounts = [
  {
    id: 'a1',
    email: 'admin@masapay.az',
    name: 'Owner',
    role: 'SUPER_ADMIN',
    enabled: true,
    restaurantId: null,
    lastLoginAt: '2026-11-26T08:00:00Z',
    passwordSet: true,
  },
  {
    id: 'm1',
    email: 'manager@dolma.az',
    name: 'Murad',
    role: 'RESTO_MANAGER',
    enabled: true,
    restaurantId: 'r1',
    lastLoginAt: null,
    passwordSet: true,
  },
  {
    id: 'w1',
    email: 'old@gmail.com',
    name: null,
    role: 'WAITER',
    enabled: false,
    restaurantId: 'r1',
    lastLoginAt: null,
    passwordSet: false,
  },
]

const restaurants = [
  {
    id: 'r1',
    name: 'Dolma',
    subscriptionStatus: 'ACTIVE',
    subscriptionEndsOn: null,
  },
  {
    id: 'r2',
    name: 'Bulvar',
    subscriptionStatus: 'ACTIVE',
    subscriptionEndsOn: null,
  },
]

const row = (text: string) =>
  screen.getByText(text).closest('tr') as HTMLElement

describe('AccountsPage', () => {
  beforeAll(() => {
    // Radix Select uses pointer capture and scrolling that jsdom lacks.
    Element.prototype.hasPointerCapture ??= () => false
    Element.prototype.releasePointerCapture ??= () => {}
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    store.dispatch(
      userLoaded({ id: 'a1', email: 'admin@masapay.az', role: 'SUPER_ADMIN' }),
    )
  })

  it('lists every account with role, restaurant and state', async () => {
    mockApi({
      'GET /api/admin/users': accounts,
      'GET /api/admin/restaurants': restaurants,
    })
    renderWithProviders(<AccountsPage />)

    await screen.findByText('Murad')
    const murad = row('Murad')
    expect(within(murad).getByText('Menecer')).toBeInTheDocument()
    expect(await within(murad).findByText('Dolma')).toBeInTheDocument()
    expect(within(murad).getByText('Hələ daxil olmayıb')).toBeInTheDocument()

    const old = row('old@gmail.com')
    expect(within(old).getByText('Deaktiv')).toBeInTheDocument()
    expect(within(old).getByText('Şifrə yoxdur')).toBeInTheDocument()

    // The super admin cannot switch themselves off.
    const owner = row('Owner')
    expect(within(owner).getByText('(siz)')).toBeInTheDocument()
    expect(
      within(owner).queryByRole('button', { name: /deaktiv et/ }),
    ).toBeNull()

    await userEvent.type(screen.getByLabelText('Axtar'), 'murad')
    expect(screen.queryByText('Owner')).toBeNull()
    expect(screen.getByText('Murad')).toBeInTheDocument()
  })

  it('creates a waiter for a restaurant', async () => {
    let sent: unknown = null
    mockApi({
      'GET /api/admin/users': accounts,
      'GET /api/admin/restaurants': restaurants,
      'POST /api/admin/users': async (request: Request) => {
        sent = await request.json()
        return { ...accounts[1], id: 'n1', role: 'WAITER' }
      },
    })
    renderWithProviders(<AccountsPage />)
    await screen.findByText('Murad')

    await userEvent.click(screen.getByRole('button', { name: 'Yeni hesab' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Aysel')
    await userEvent.type(
      within(dialog).getByLabelText('Email'),
      'aysel@dolma.az',
    )
    await userEvent.type(
      within(dialog).getByLabelText('Şifrə'),
      'waiter-pass-1',
    )
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Rol' }))
    await userEvent.click(screen.getByRole('option', { name: 'Ofisiant' }))

    const create = within(dialog).getByRole('button', { name: 'Yarat' })
    // A waiter needs a restaurant first.
    expect(create).toBeDisabled()
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Restoran' }),
    )
    await userEvent.click(screen.getByRole('option', { name: 'Bulvar' }))
    await userEvent.click(create)

    await waitFor(() =>
      expect(sent).toEqual({
        name: 'Aysel',
        email: 'aysel@dolma.az',
        password: 'waiter-pass-1',
        role: 'WAITER',
        restaurantId: 'r2',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a super admin is created without a restaurant, and a taken email is explained', async () => {
    let sent: unknown = null
    mockApi({
      'GET /api/admin/users': accounts,
      'GET /api/admin/restaurants': restaurants,
      'POST /api/admin/users': async (request: Request) => {
        sent = await request.json()
        return new Response(JSON.stringify({ status: 409 }), { status: 409 })
      },
    })
    renderWithProviders(<AccountsPage />)
    await screen.findByText('Murad')

    await userEvent.click(screen.getByRole('button', { name: 'Yeni hesab' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Ad'), 'Second')
    await userEvent.type(
      within(dialog).getByLabelText('Email'),
      'admin@masapay.az',
    )
    await userEvent.type(
      within(dialog).getByLabelText('Şifrə'),
      'second-admin-1',
    )
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Rol' }))
    await userEvent.click(screen.getByRole('option', { name: 'Super admin' }))
    expect(
      within(dialog).queryByRole('combobox', { name: 'Restoran' }),
    ).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yarat' }))

    expect(
      await within(dialog).findByText('Bu email ilə artıq hesab var.'),
    ).toBeInTheDocument()
    expect(sent).toMatchObject({ role: 'SUPER_ADMIN', restaurantId: null })
  })

  it('switches an account on and sets a new password', async () => {
    const sent: unknown[] = []
    mockApi({
      'GET /api/admin/users': accounts,
      'GET /api/admin/restaurants': restaurants,
      'PATCH /api/admin/users/w1': async (request: Request) => {
        sent.push(await request.json())
        return { ...accounts[2], enabled: true }
      },
      'PUT /api/admin/users/w1/password': async (request: Request) => {
        sent.push(await request.json())
        return new Response(null, { status: 204 })
      },
    })
    renderWithProviders(<AccountsPage />)
    await screen.findByText('Murad')

    await userEvent.click(
      screen.getByRole('button', { name: 'old@gmail.com aktiv et' }),
    )
    await waitFor(() => expect(sent[0]).toEqual({ enabled: true }))

    await userEvent.click(
      screen.getByRole('button', { name: 'old@gmail.com üçün yeni şifrə' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Yeni şifrə'),
      'brand-new-pass',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Şifrəni təyin et' }),
    )

    await waitFor(() =>
      expect(sent[1]).toEqual({ newPassword: 'brand-new-pass' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'old@gmail.com üçün yeni şifrə təyin olundu.',
    )
  })

  it('edits role and restaurant, and keeps the own role locked', async () => {
    let sent: unknown = null
    mockApi({
      'GET /api/admin/users': accounts,
      'GET /api/admin/restaurants': restaurants,
      'PATCH /api/admin/users/m1': async (request: Request) => {
        sent = await request.json()
        return accounts[1]
      },
    })
    renderWithProviders(<AccountsPage />)
    await screen.findByText('Murad')

    await userEvent.click(
      screen.getByRole('button', { name: 'admin@masapay.az düzəliş et' }),
    )
    let dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('combobox', { name: 'Rol' })).toBeDisabled()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'İmtina' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await userEvent.click(
      screen.getByRole('button', { name: 'manager@dolma.az düzəliş et' }),
    )
    dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Restoran' }),
    )
    await userEvent.click(screen.getByRole('option', { name: 'Bulvar' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Yadda saxla' }),
    )

    await waitFor(() =>
      expect(sent).toEqual({
        name: 'Murad',
        role: 'RESTO_MANAGER',
        restaurantId: 'r2',
      }),
    )
  })
})
