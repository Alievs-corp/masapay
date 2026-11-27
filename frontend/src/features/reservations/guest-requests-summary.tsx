import {
  Accessibility,
  Baby,
  NotebookPen,
  PartyPopper,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hasAnyRequest } from './guest-requests'
import type { GuestRequests } from './types'

// Read-only view of the guest's requests: the allergy first, as a warning, then
// child seats, wheelchair access, occasion and the note.
export function GuestRequestsSummary({
  requests,
  note,
}: {
  requests: GuestRequests
  note: string | null
}) {
  const { t } = useTranslation('reservations')
  if (!hasAnyRequest(requests, note)) {
    return <p className="text-sm text-muted-foreground">{t('notes.none')}</p>
  }
  const allergyList = requests.allergens
    .map((a) => t(`notes.allergens.${a}`))
    .join(', ')
  return (
    <div className="space-y-2 text-sm">
      {requests.allergens.length > 0 && (
        <div
          role="note"
          className="flex gap-2 rounded-xl border border-destructive/60 bg-destructive/5 p-3 text-destructive"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {t('notes.allergyWarning', { list: allergyList })}
            </p>
            {requests.allergyNote && (
              <p className="whitespace-pre-line">{requests.allergyNote}</p>
            )}
          </div>
        </div>
      )}
      <ul className="flex flex-wrap gap-2">
        {requests.childSeats > 0 && (
          <li className="flex items-center gap-1.5 rounded-full bg-[#F6F5F6] px-3 py-1 dark:bg-[#0A0A0A]">
            <Baby aria-hidden className="size-4" />
            {t('notes.summaryChildSeats', { count: requests.childSeats })}
          </li>
        )}
        {requests.wheelchair && (
          <li className="flex items-center gap-1.5 rounded-full bg-[#F6F5F6] px-3 py-1 dark:bg-[#0A0A0A]">
            <Accessibility aria-hidden className="size-4" />
            {t('notes.summaryWheelchair')}
          </li>
        )}
        {requests.occasion && (
          <li className="flex items-center gap-1.5 rounded-full bg-[#F6F5F6] px-3 py-1 dark:bg-[#0A0A0A]">
            <PartyPopper aria-hidden className="size-4" />
            {t(`notes.occasions.${requests.occasion}`)}
          </li>
        )}
      </ul>
      {note?.trim() && (
        <p className="flex gap-2 rounded-xl bg-[#F6F5F6] p-3 dark:bg-[#0A0A0A]">
          <NotebookPen aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="whitespace-pre-line">{note}</span>
        </p>
      )}
    </div>
  )
}
