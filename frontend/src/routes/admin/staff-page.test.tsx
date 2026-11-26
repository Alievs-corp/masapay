import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded } from '@/features/auth/auth-slice'
import { StaffPage } from '@/routes/admin/staff-page'
import { mockApi, renderWithProviders } from '@/test/utils'

const STAFF_URL = '/api/admin/restaurants/r1/staff'

const staff = [
  {
    id: 'u1',
    email: 'aysel@dolma.az',
    name: 'Aysel',
    role: 'WAITER',
    status: 'DEACTIVATED',
    lastLoginAt: '2026-10-22T09:00:00Z',
    passwordSet: true,
  },
  {
    id: 'u2',
    email: 'murad@dolma.az',
    name: 'Murad',
    role: 'CHEF',
    status: 'ACTIVE',
    lastLoginAt: '2026-10-22T08:00:00Z',
    passwordSet: true,
  },
  {
    id: 'u3',
    email: 'old@gmail.com',
    name: null,
    role: 'WAITER',
    status: 'ACTIVE',
    lastLoginAt: null,
    passwordSet: false,
  },
]

const row = (text: string) =>
  screen.getByText(text).closest('tr') as HTMLElement

describe('StaffPage (#145)', () => {
  beforeAll(() => {
    // Radix Select uses pointer capture and scrolling that jsdom lacks.
    Element.prototype.hasPointerCapture ??= () => false
    Element.prototype.releasePointerCapture ??= () => {}
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    store.dispatch(
      userLoaded({ id: 'm1', email: 'm@dolma.az', role: 'RESTO_MANAGER' }),
    )
  })

  it('lists the staff with their state and the right action for each', async () => {
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      [`GET ${STAFF_URL}`]: staff,
    })
    renderWithProviders(<StaffPage />)

    await screen.findByText('Aysel')
    const aysel = row('Aysel')
    expect(within(aysel).getByText('Deaktiv')).toBeInTheDocument()
    expect(
      within(aysel).getByRole('button', { name: 'aysel@dolma.az aktiv et' }),
    ).toBeInTheDocument()

    const murad = row('Murad')
    expect(within(murad).getByText('Aktiv')).toBeInTheDocument()
    expect(
      within(murad).getByRole('button', { name: 'murad@dolma.az deaktiv et' }),
    ).toBeInTheDocument()

    // An old account without a password is told to get one.
    const old = row('old@gmail.com')
    expect(within(old).getByText(/Şifrə yoxdur/)).toBeInTheDocument()
    expect(screen.queryByText(/Google/)).toBeNull()
  })

  it('creates a chef with a password and switches a waiter back on', async () => {
    const sent: unknown[] = []
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      [`GET ${STAFF_URL}`]: staff,
      [`POST ${STAFF_URL}`]: async (request: Request) => {
        sent.push(await request.json())
        return { ...staff[1], id: 'u4', email: 'chef@dolma.az' }
      },
      [`PATCH ${STAFF_URL}/u1`]: async (request: Request) => {
        sent.push(await request.json())
        return { ...staff[0], status: 'ACTIVE' }
      },
    })
    renderWithProviders(<StaffPage />)
    await screen.findByText('Aysel')

    const create = screen.getByRole('button', { name: 'Hesab yarat' })
    await userEvent.type(screen.getByLabelText('Ad'), 'Leyla')
    await userEvent.type(screen.getByLabelText('Email'), 'chef@dolma.az')
    await userEvent.type(screen.getByLabelText('Şifrə'), 'short')
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Şifrə'), '-chef-pass')
    await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }))
    await userEvent.click(screen.getByRole('option', { name: 'Aşpaz' }))
    await userEvent.click(create)

    await waitFor(() =>
      expect(sent[0]).toEqual({
        name: 'Leyla',
        email: 'chef@dolma.az',
        password: 'short-chef-pass',
        role: 'CHEF',
      }),
    )
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue(''))
    expect(screen.getByLabelText('Şifrə')).toHaveValue('')

    await userEvent.click(
      screen.getByRole('button', { name: 'aysel@dolma.az aktiv et' }),
    )
    await waitFor(() => expect(sent[1]).toEqual({ active: true }))
  })

  it('sets a new password for a staff member', async () => {
    let sent: unknown = null
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      [`GET ${STAFF_URL}`]: staff,
      [`PUT ${STAFF_URL}/u2/password`]: async (request: Request) => {
        sent = await request.json()
        return new Response(null, { status: 204 })
      },
    })
    renderWithProviders(<StaffPage />)
    await screen.findByText('Murad')

    await userEvent.click(
      screen.getByRole('button', { name: 'murad@dolma.az üçün yeni şifrə' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Yeni şifrə'),
      'brand-new-pass',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Şifrəni təyin et' }),
    )

    await waitFor(() => expect(sent).toEqual({ newPassword: 'brand-new-pass' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Murad üçün yeni şifrə təyin olundu.',
    )
  })

  it('says when the email already has an account', async () => {
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      [`GET ${STAFF_URL}`]: [],
      [`POST ${STAFF_URL}`]: new Response(JSON.stringify({ status: 409 }), {
        status: 409,
      }),
    })
    renderWithProviders(<StaffPage />)

    await userEvent.type(await screen.findByLabelText('Ad'), 'Boss')
    await userEvent.type(screen.getByLabelText('Email'), 'boss@dolma.az')
    await userEvent.type(screen.getByLabelText('Şifrə'), 'boss-password')
    await userEvent.click(screen.getByRole('button', { name: 'Hesab yarat' }))

    expect(
      await screen.findByText('Bu email ilə artıq hesab var.'),
    ).toBeInTheDocument()
  })
})
