import type { TFunction } from 'i18next'
import { DoorClosed, MapPin, Navigation } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GuestRequestsSummary } from './guest-requests-summary'
import { requestsOf } from './guest-requests'
import { ReservationMiniFloor } from './reservation-mini-floor'
import { formatInstant, money, tableName } from './reservation-format'
import type { ReservationView } from './types'

// The table information the guest needs on arrival (spec 11.3): table or cabin,
// floor and where it is, directions, the 2D view with the table highlighted, the
// pre-ordered dishes, paid / remaining and the notes. Opens directly on
// /reservation/:code from the start time until the hold ends (and while seated),
// and first on the table page after scanning that table's QR.

function directionsOf(
  t: TFunction<'reservations'>,
  r: ReservationView,
): string {
  return (
    r.table.locationDescription ||
    [t('view.floor', { floor: r.table.floor }), r.table.zone]
      .filter(Boolean)
      .join(', ')
  )
}

export function ReservationArrivalView({
  reservation: r,
  headline = true,
  className,
}: {
  reservation: ReservationView
  /** The big "Your table is ready" heading (off inside the dialog, which has its own). */
  headline?: boolean
  className?: string
}) {
  const { t } = useTranslation('reservations')
  const name = tableName(t, r.table)
  const seated = r.status === 'SEATED'
  const Icon = r.table.kind === 'CABIN' ? DoorClosed : MapPin

  return (
    <section
      aria-label={t('arrivalView.whereTitle')}
      data-testid="arrival-view"
      className={cn('space-y-4', className)}
    >
      {headline && (
        <div className="space-y-1 rounded-2xl bg-[#08CB00] p-4 text-black">
          <p className="text-xl font-semibold">
            {seated ? t('arrivalView.seatedTitle') : t('arrivalView.title')}
          </p>
          <p className="text-sm">{t('arrivalView.text', { table: name })}</p>
          {!seated && (
            <p className="text-xs">
              {t('arrivalView.validUntil', {
                time: formatInstant(r.validUntil),
              })}
            </p>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <Icon aria-hidden className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">
            {t('view.floor', { floor: r.table.floor })}
            {r.table.zone ? ` · ${r.table.zone}` : ''}
            {' · '}
            {t('reserve.seats', { count: r.table.seats })}
          </p>
          <p className="flex gap-1.5 text-sm">
            <Navigation aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">{t('arrival.directions')}: </span>
              {directionsOf(t, r)}
            </span>
          </p>
        </div>
      </div>

      <ReservationMiniFloor
        tables={r.floorTables}
        highlight={r.table}
        label={t('view.mapLabel', { table: name })}
      />

      <div className="space-y-2 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/15">
        <h3 className="font-semibold">{t('arrival.orders')}</h3>
        {r.items.length === 0 ? (
          <p className="text-muted-foreground">{t('arrival.noOrders')}</p>
        ) : (
          <ul className="space-y-1">
            {r.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.name}{' '}
                  <span className="text-muted-foreground">
                    x{item.quantity}
                  </span>
                </span>
                <span className="tabular-nums">
                  {money(item.totalPrice, r.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between gap-2 border-t border-black/10 pt-2 dark:border-white/15">
          <span className="text-muted-foreground">{t('view.paid')}</span>
          <span className="tabular-nums">
            {money(r.paidAmount, r.currency)}
          </span>
        </div>
        <div className="flex justify-between gap-2 font-semibold">
          <span>{t('view.remaining')}</span>
          <span className="tabular-nums">{money(r.remaining, r.currency)}</span>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <h3 className="text-sm font-semibold">{t('notes.title')}</h3>
        <GuestRequestsSummary requests={requestsOf(r)} note={r.note} />
      </div>
    </section>
  )
}
