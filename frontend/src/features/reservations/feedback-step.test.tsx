import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderWithProviders } from '@/test/utils'
import { FeedbackStep } from './feedback-step'
import { canSubmitFeedback, noteRequired } from './feedback-rules'

describe('feedback rules', () => {
  it('requires a note for 6 or lower only', () => {
    expect(noteRequired(1)).toBe(true)
    expect(noteRequired(6)).toBe(true)
    expect(noteRequired(7)).toBe(false)
    expect(noteRequired(10)).toBe(false)
    expect(canSubmitFeedback(null, '')).toBe(false)
    expect(canSubmitFeedback(6, '   ')).toBe(false)
    expect(canSubmitFeedback(6, 'Slow')).toBe(true)
    expect(canSubmitFeedback(7, '')).toBe(true)
    expect(canSubmitFeedback(11, 'x')).toBe(false)
  })
})

describe('FeedbackStep', () => {
  it('shows ten N/10 buttons and blocks a low score without a note', async () => {
    let sent: unknown = null
    const fetchMock = mockApi({
      'POST /api/public/feedback': async (req: Request) => {
        sent = await req.json()
        return {
          id: 'f1',
          score: 4,
          note: 'x',
          createdAt: '2026-11-27T15:00:00Z',
        }
      },
    })
    renderWithProviders(<FeedbackStep transactionId="tx-1" />)
    const user = userEvent.setup()

    expect(screen.getAllByRole('radio')).toHaveLength(10)
    expect(screen.getByRole('radio', { name: '1/10' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '10/10' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: '4/10' }))
    expect(screen.getByText('Niyə razı qalmadınız?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Göndər/ }))
    expect(screen.getByText('Zəhmət olmasa səbəbi yazın.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox'), 'Uzun gözlədik')
    await user.click(screen.getByRole('button', { name: /Göndər/ }))
    expect(
      await screen.findByText('Rəyiniz üçün təşəkkür edirik.'),
    ).toBeInTheDocument()
    expect(sent).toEqual({
      transactionId: 'tx-1',
      score: 4,
      note: 'Uzun gözlədik',
    })
  })

  it('sends a high score without a note', async () => {
    let sent: unknown = null
    mockApi({
      'POST /api/public/feedback': async (req: Request) => {
        sent = await req.json()
        return {
          id: 'f2',
          score: 9,
          note: null,
          createdAt: '2026-11-27T15:00:00Z',
        }
      },
    })
    renderWithProviders(<FeedbackStep transactionId="tx-2" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('radio', { name: '9/10' }))
    expect(screen.getByText('Rəyiniz (istəyə bağlı)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Göndər/ }))
    expect(
      await screen.findByText('Rəyiniz üçün təşəkkür edirik.'),
    ).toBeInTheDocument()
    expect(sent).toEqual({
      transactionId: 'tx-2',
      score: 9,
      note: null,
    })
  })
})
