import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { tokenReceived } from '@/features/auth/auth-slice'
import { SettingsPage } from '@/routes/admin/settings-page'
import { mockApi, renderWithProviders } from '@/test/utils'

async function fill(current: string, next: string, repeat: string) {
  await userEvent.type(screen.getByLabelText('Cari şifrə'), current)
  await userEvent.type(screen.getByLabelText('Yeni şifrə'), next)
  await userEvent.type(screen.getByLabelText('Yeni şifrə (təkrar)'), repeat)
}

const save = () => screen.getByRole('button', { name: 'Şifrəni dəyiş' })

describe('Change password (settings)', () => {
  beforeEach(() => {
    store.dispatch(
      tokenReceived({
        accessToken: 'access',
        user: { id: 'w1', email: 'waiter@dolma.az', role: 'WAITER' },
      }),
    )
  })

  it('a waiter sees only the password form and changes it', async () => {
    const sent: unknown[] = []
    const fetchMock = mockApi({
      'POST /api/auth/password': async (request: Request) => {
        sent.push(await request.json())
        return new Response(null, { status: 204 })
      },
    })
    renderWithProviders(<SettingsPage />)

    expect(screen.getByText('Hesabınızın şifrəsi')).toBeInTheDocument()
    expect(screen.queryByText('Xidmət haqqı')).toBeNull()

    await fill('old-password-1', 'new-password-2', 'new-password-2')
    await userEvent.click(save())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Şifrə dəyişdirildi.',
    )
    expect(sent).toEqual([
      { currentPassword: 'old-password-1', newPassword: 'new-password-2' },
    ])
    expect(screen.getByLabelText('Cari şifrə')).toHaveValue('')
    // A waiter has no restaurant settings to load.
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input instanceof Request ? input.url : input).includes(
          '/admin/restaurants',
        ),
      ),
    ).toBe(false)
  })

  it('says when the current password is wrong', async () => {
    mockApi({
      'POST /api/auth/password': new Response(
        JSON.stringify({ status: 400, detail: 'CURRENT_PASSWORD_INCORRECT' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    })
    renderWithProviders(<SettingsPage />)

    await fill('not-my-password', 'new-password-2', 'new-password-2')
    await userEvent.click(save())

    expect(await screen.findByText('Cari şifrə yanlışdır.')).toBeInTheDocument()
  })

  it('keeps the button off until the new password is long enough and repeated', async () => {
    mockApi({})
    renderWithProviders(<SettingsPage />)

    await fill('old-password-1', 'short', 'short')
    expect(screen.getByText('Ən azı 10 simvol olmalıdır.')).toBeInTheDocument()
    expect(save()).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Yeni şifrə'), '-but-longer')
    expect(screen.getByText('Şifrələr eyni deyil.')).toBeInTheDocument()
    expect(save()).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText('Yeni şifrə (təkrar)'),
      '-but-longer',
    )
    await waitFor(() => expect(save()).toBeEnabled())
  })
})
