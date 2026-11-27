import { useTranslation } from 'react-i18next'
import { Accessibility, Baby, Cake, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Allergen } from '@/features/reservations/types'
import { cn } from '@/lib/utils'
import {
  hasAllergy,
  hasAnyRequest,
  type StaffRequests,
} from './guest-requests-model'

// Staff views of the guest requests and allergies (spec section 11).

/** The allergy as a loud warning box: staff must not miss it. */
export function AllergyWarning({
  allergens,
  allergyNote,
  source,
  className,
}: {
  allergens: Allergen[]
  allergyNote: string | null
  /** Optional second line, e.g. which reservation it comes from. */
  source?: string
  className?: string
}) {
  const { t } = useTranslation('adminReservations')
  if (allergens.length === 0 && !allergyNote) return null
  return (
    <div
      role="alert"
      className={cn(
        'space-y-1 rounded-lg border-2 border-destructive bg-background px-3 py-2 text-sm',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-bold text-destructive">
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        {t('requests.allergyTitle')}
        {allergens.length > 0 && (
          <span className="font-semibold text-foreground">
            {allergens.map((a) => t(`requests.allergens.${a}`)).join(', ')}
          </span>
        )}
      </p>
      {allergyNote && <p>{t('requests.allergyNote', { note: allergyNote })}</p>}
      {source && <p className="text-xs text-muted-foreground">{source}</p>}
    </div>
  )
}

/** Small badges for a list row: allergy first, then the other requests. */
export function RequestBadges({ requests }: { requests: StaffRequests }) {
  const { t } = useTranslation('adminReservations')
  if (!hasAnyRequest(requests)) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {hasAllergy(requests) && (
        <Badge className="gap-1 border-transparent bg-destructive text-destructive-foreground">
          <TriangleAlert aria-hidden className="size-3" />
          {t('requests.allergyBadge')}
          {requests.allergens.length > 0 &&
            `: ${requests.allergens
              .map((a) => t(`requests.allergens.${a}`))
              .join(', ')}`}
        </Badge>
      )}
      {requests.childSeats > 0 && (
        <Badge variant="outline" className="gap-1">
          <Baby aria-hidden className="size-3" />
          {t('requests.childSeatsBadge', { count: requests.childSeats })}
        </Badge>
      )}
      {requests.wheelchair && (
        <Badge variant="outline" className="gap-1">
          <Accessibility aria-hidden className="size-3" />
          {t('requests.wheelchair')}
        </Badge>
      )}
      {requests.occasion && (
        <Badge variant="outline" className="gap-1">
          <Cake aria-hidden className="size-3" />
          {t(`requests.occasions.${requests.occasion}`, {
            defaultValue: requests.occasion,
          })}
        </Badge>
      )}
    </div>
  )
}

/** The requests section of the staff detail: allergy box, then the rest. */
export function GuestRequestsSection({
  requests,
}: {
  requests: StaffRequests
}) {
  const { t } = useTranslation('adminReservations')
  return (
    <section className="space-y-2" aria-label={t('requests.title')}>
      <h3 className="text-sm font-semibold">{t('requests.title')}</h3>
      <AllergyWarning
        allergens={requests.allergens}
        allergyNote={requests.allergyNote}
      />
      {!hasAnyRequest(requests) ? (
        <p className="text-sm text-muted-foreground">{t('requests.none')}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {requests.childSeats > 0 && (
            <>
              <dt className="text-muted-foreground">
                {t('requests.childSeats')}
              </dt>
              <dd className="font-semibold tabular-nums">
                {requests.childSeats}
              </dd>
            </>
          )}
          {requests.wheelchair && (
            <>
              <dt className="text-muted-foreground">
                {t('requests.wheelchair')}
              </dt>
              <dd className="font-semibold">{t('requests.yes')}</dd>
            </>
          )}
          {requests.occasion && (
            <>
              <dt className="text-muted-foreground">
                {t('requests.occasion')}
              </dt>
              <dd className="font-semibold">
                {t(`requests.occasions.${requests.occasion}`, {
                  defaultValue: requests.occasion,
                })}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  )
}
