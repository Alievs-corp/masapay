import { useState } from 'react'
import { CircleCheckBig, LoaderCircle, NotebookPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { problemReason } from '@/lib/api-errors'
import type { ArrivalPhase } from './arrival-phase'
import { GuestRequestsForm } from './guest-requests-form'
import { GuestRequestsSummary } from './guest-requests-summary'
import {
  notesValueOf,
  requestsOf,
  toNotesRequest,
  type GuestNotesValue,
} from './guest-requests'
import { useUpdateReservationNotesMutation } from './reservations-api'
import type { ReservationView } from './types'

// The guest's requests on /reservation/:code: read-only summary, and an editor
// until the start time (spec 11.1: PUT /reservations/{code}/notes).
export function ReservationNotesSection({
  reservation: r,
  phase,
}: {
  reservation: ReservationView
  phase: ArrivalPhase
}) {
  const { t } = useTranslation('reservations')
  const [draft, setDraft] = useState<GuestNotesValue | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, saveState] = useUpdateReservationNotesMutation()
  // The server decides; before it sends the flag, fall back to the same rule.
  const canEdit =
    phase === 'UPCOMING' && (r.canEditNotes ?? r.status === 'CONFIRMED')

  const submit = async () => {
    if (!draft) return
    try {
      await save({ code: r.code, ...toNotesRequest(draft) }).unwrap()
      setDraft(null)
      setSaved(true)
    } catch {
      // Shown below.
    }
  }

  const locked =
    saveState.isError &&
    problemReason(saveState.error as Parameters<typeof problemReason>[0]) ===
      'NOTES_LOCKED'

  return (
    <section className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <NotebookPen aria-hidden className="size-4" />
          {t('notes.title')}
        </h2>
        {canEdit && !draft && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setSaved(false)
              setDraft(notesValueOf(r))
            }}
          >
            {t('notes.edit')}
          </Button>
        )}
      </div>

      {draft && canEdit ? (
        <>
          <GuestRequestsForm
            value={draft}
            onChange={setDraft}
            idPrefix="edit"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDraft(null)}
            >
              {t('notes.cancelEdit')}
            </Button>
            <Button
              className="rounded-xl bg-black text-white hover:bg-black/85"
              disabled={saveState.isLoading}
              onClick={() => void submit()}
            >
              {saveState.isLoading && (
                <LoaderCircle className="animate-spin" aria-hidden />
              )}
              {saveState.isLoading ? t('notes.saving') : t('notes.save')}
            </Button>
          </div>
        </>
      ) : (
        <GuestRequestsSummary requests={requestsOf(r)} note={r.note} />
      )}

      {saved && !draft && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <CircleCheckBig aria-hidden className="size-4 text-[#08CB00]" />
          {t('notes.saved')}
        </p>
      )}
      {saveState.isError && (
        <p role="alert" className="text-sm text-destructive">
          {locked ? t('reserve.errors.NOTES_LOCKED') : t('notes.saveError')}
        </p>
      )}
      {!canEdit && phase === 'UPCOMING' && (
        <p className="text-xs text-muted-foreground">{t('notes.locked')}</p>
      )}
    </section>
  )
}
