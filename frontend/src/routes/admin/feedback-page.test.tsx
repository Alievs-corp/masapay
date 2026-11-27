import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { store } from '@/app/store'
import { userLoaded } from '@/features/auth/auth-slice'
import { FeedbackPage } from '@/routes/admin/feedback-page'
import { mockApi, renderWithProviders, requestsOf } from '@/test/utils'

const list = {
  averageScore: 7.5,
  count: 2,
  items: [
    {
      id: 'f1',
      score: 4,
      note: 'Waited 30 minutes',
      tableLabel: 'T3',
      kind: 'TABLE_BILL',
      reservationCode: null,
      amountPaid: 42.5,
      currency: 'AZN',
      createdAt: '2026-11-27T10:00:00Z',
    },
    {
      id: 'f2',
      score: 10,
      note: null,
      tableLabel: 'C5',
      kind: 'RESERVATION',
      reservationCode: 'K7Q2M9XP3A',
      amountPaid: 20,
      currency: 'AZN',
      createdAt: '2026-11-27T11:00:00Z',
    },
  ],
}

describe('FeedbackPage', () => {
  it('shows the average out of 10 and each entry with its score, note, table and amount', async () => {
    store.dispatch(
      userLoaded({ id: 'u1', email: 'm@x.az', role: 'RESTO_MANAGER' }),
    )
    mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/feedback': list,
    })
    renderWithProviders(<FeedbackPage />)

    expect(await screen.findByTestId('feedback-average')).toHaveTextContent(
      '7.5/10',
    )
    const rows = within(screen.getByRole('table'))
    expect(rows.getByText('4/10')).toBeInTheDocument()
    expect(rows.getByText('10/10')).toBeInTheDocument()
    expect(screen.getByText('Waited 30 minutes')).toBeInTheDocument()
    expect(screen.getByText('Qeyd yoxdur')).toBeInTheDocument()
    expect(screen.getByText('T3')).toBeInTheDocument()
    expect(screen.getByText('Rezerv K7Q2M9XP3A')).toBeInTheDocument()
  })

  it('sends the score filter to the server', async () => {
    store.dispatch(
      userLoaded({ id: 'u1', email: 'm@x.az', role: 'RESTO_MANAGER' }),
    )
    const fetchMock = mockApi({
      'GET /api/admin/restaurants': [{ id: 'r1', name: 'Dolma' }],
      'GET /api/admin/restaurants/r1/feedback': {
        averageScore: null,
        count: 0,
        items: [],
      },
    })
    renderWithProviders(<FeedbackPage />)

    expect(
      await screen.findByText('Bu filtrlərlə rəy yoxdur.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '1-6 (narazı)' }))

    await waitFor(() =>
      expect(
        requestsOf(fetchMock).some(
          (r) =>
            r.startsWith('GET /api/admin/restaurants/r1/feedback?') &&
            r.includes('minScore=1') &&
            r.includes('maxScore=6'),
        ),
      ).toBe(true),
    )
  })
})
