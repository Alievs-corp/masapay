import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheckBig, LoaderCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSubmitServiceFeedbackMutation } from './reservations-api'
import { canSubmitFeedback, noteRequired } from './feedback-rules'

// "How satisfied are you with the service?" after a successful payment (table bill
// or reservation prepay): ten buttons 1/10 .. 10/10; a score of 6 or lower needs a
// note ("Why were you not satisfied?"), 7-10 may add one.

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1)
const NOTE_MAX = 1000

function hasReason(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object' || !('data' in error)) return false
  const data = (error as { data?: unknown }).data
  if (typeof data === 'string') return data.includes(code)
  if (data && typeof data === 'object') {
    return Object.values(data as Record<string, unknown>).some(
      (v) => typeof v === 'string' && v.includes(code),
    )
  }
  return false
}

export function FeedbackStep({ transactionId }: { transactionId: string }) {
  const { t } = useTranslation('feedback')
  const [score, setScore] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [submit, { isLoading, isSuccess, error }] =
    useSubmitServiceFeedbackMutation()

  const alreadySent = hasReason(error, 'FEEDBACK_EXISTS')

  if (isSuccess || alreadySent) {
    return (
      <Card className="w-full max-w-md rounded-2xl" aria-live="polite">
        <CardContent className="flex items-center gap-3 p-6">
          <CircleCheckBig
            className="size-6 shrink-0 text-success"
            aria-hidden
          />
          <p className="text-sm font-medium">{t('thanks')}</p>
        </CardContent>
      </Card>
    )
  }

  const needNote = noteRequired(score)
  const showNoteError = touched && needNote && note.trim().length === 0

  const send = () => {
    setTouched(true)
    if (score === null || !canSubmitFeedback(score, note)) return
    const trimmed = note.trim()
    void submit({ transactionId, score, note: trimmed ? trimmed : null })
  }

  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{t('page.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="radiogroup"
          aria-label={t('page.title')}
          className="grid grid-cols-5 gap-2"
        >
          {SCORES.map((n) => {
            const selected = score === n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setScore(n)}
                className={cn(
                  'h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-[#08CB00] bg-[#08CB00] text-black'
                    : 'border-black/15 bg-white text-black hover:bg-[#F6F5F6] dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white',
                )}
              >
                {t('score', { score: n })}
              </button>
            )
          })}
        </div>

        {score !== null && (
          <div className="space-y-2">
            <Label htmlFor="feedback-note">
              {needNote ? t('whyTitle') : t('noteOptional')}
            </Label>
            <Textarea
              id="feedback-note"
              value={note}
              maxLength={NOTE_MAX}
              required={needNote}
              aria-invalid={showNoteError}
              placeholder={t('notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            {showNoteError && (
              <p role="alert" className="text-sm text-destructive">
                {t('noteRequired')}
              </p>
            )}
          </div>
        )}

        {error && !alreadySent && (
          <p role="alert" className="text-sm text-destructive">
            {t('error')}
          </p>
        )}

        <Button
          className="w-full rounded-xl bg-black text-white hover:bg-black/85"
          disabled={score === null || isLoading}
          onClick={send}
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
          {t('submit')}
        </Button>
      </CardContent>
    </Card>
  )
}
