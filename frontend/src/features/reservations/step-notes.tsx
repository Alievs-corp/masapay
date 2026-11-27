import { ArrowLeft, NotebookPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { GuestRequestsForm } from './guest-requests-form'
import type { GuestNotesValue } from './guest-requests'

// Notes step of the reserve flow (spec 11.1), after the contact details and
// before "Add dishes from the menu?": child seats, wheelchair access, occasion,
// allergies and a note. Everything is optional; "Continue" creates the booking.
export function StepNotes({
  value,
  onChange,
  onSubmit,
  onSkip,
  onBack,
  submitting,
  error,
}: {
  value: GuestNotesValue
  onChange: (next: GuestNotesValue) => void
  onSubmit: () => void
  onSkip: () => void
  onBack: () => void
  submitting: boolean
  error: string | null
}) {
  const { t } = useTranslation('reservations')
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="-ml-2 size-9 shrink-0"
          aria-label={t('notes.back')}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <NotebookPen aria-hidden className="size-5" />
            {t('notes.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('notes.hint')}</p>
        </div>
      </div>

      <GuestRequestsForm value={value} onChange={onChange} idPrefix="reserve" />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={submitting}
          onClick={onSkip}
        >
          {t('notes.skip')}
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {t('notes.continue')}
        </Button>
      </div>
    </form>
  )
}
