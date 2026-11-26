import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { store } from '@/app/store'
import { loggedOut } from '@/features/auth/auth-slice'
import { LoginPage } from '@/routes/admin/login-page'
import { mockApi, renderWithProviders } from '@/test/utils'

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<p>Admin panel</p>} />
    </Routes>,
    { route: '/admin/login' },
  )
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })

describe('LoginPage', () => {
  beforeEach(() => {
    store.dispatch(loggedOut())
  })

  it('signs in with email and password and opens the panel', async () => {
    const sent: unknown[] = []
    mockApi({
      'POST /api/auth/login': async (request: Request) => {
        sent.push(await request.json())
        return {
          userId: 'u1',
          email: 'manager@dolma.az',
          name: 'Murad',
          role: 'RESTO_MANAGER',
          tokens: { accessToken: 'access-1', expiresInSeconds: 900 },
        }
      },
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email'), ' manager@dolma.az ')
    await userEvent.type(screen.getByLabelText('Şifrə'), 'correct-password')
    await userEvent.click(screen.getByRole('button', { name: 'Daxil ol' }))

    expect(await screen.findByText('Admin panel')).toBeInTheDocument()
    expect(sent[0]).toEqual({
      email: 'manager@dolma.az',
      password: 'correct-password',
    })
    expect(store.getState().auth).toMatchObject({
      accessToken: 'access-1',
      status: 'authenticated',
      user: { id: 'u1', email: 'manager@dolma.az', role: 'RESTO_MANAGER' },
    })
  })

  it('says the email or password is wrong on a 401', async () => {
    mockApi({
      'POST /api/auth/login': json(401, {
        status: 401,
        detail: 'Invalid email or password',
      }),
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email'), 'x@dolma.az')
    await userEvent.type(screen.getByLabelText('Şifrə'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Daxil ol' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email və ya şifrə yanlışdır.',
    )
    expect(store.getState().auth.accessToken).toBeNull()
  })

  it('asks to wait after too many attempts', async () => {
    mockApi({ 'POST /api/auth/login': json(429, { status: 429 }) })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email'), 'x@dolma.az')
    await userEvent.type(screen.getByLabelText('Şifrə'), 'some-password')
    await userEvent.click(screen.getByRole('button', { name: 'Daxil ol' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Çox sayda cəhd/)
  })

  it('cannot be sent empty and can show the password', async () => {
    mockApi({})
    renderLogin()

    const submit = screen.getByRole('button', { name: 'Daxil ol' })
    expect(submit).toBeDisabled()

    const password = screen.getByLabelText('Şifrə')
    await userEvent.type(password, 'secret-password')
    expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(
      screen.getByRole('button', { name: 'Şifrəni göstər' }),
    )
    await waitFor(() => expect(password).toHaveAttribute('type', 'text'))
    expect(submit).toBeDisabled()
  })
})
