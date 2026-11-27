import { CalendarClock, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { currentLocale } from '@/i18n'
import { formatCurrency } from '@/features/order/format'
import { toMinor } from '@/features/order/order-api'
import type { ReservationView } from './types'

// "Will you pay now?" with the server's totals (items, pay now, remaining)
// and the policy: how long the booking is held and what is refunded.

export function ReservePolicy({
  reservation,
}: {
  reservation: ReservationView
}) {
  const { t } = useTranslation('reservations')
  const { policy } = reservation
  const until = new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Baku',
  }).format(new Date(policy.freeCancelUntil))
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
      <li>{t('reserve.policy.hold', { minutes: policy.holdMinutes })}</li>
      <li>{t('reserve.policy.freeCancel', { until })}</li>
      <li>
        {t('reserve.policy.lateCancel', {
          percent: policy.lateCancelRefundPercent,
        })}
      </li>
      <li>
        {t('reserve.policy.noShow', { percent: policy.noShowRefundPercent })}
      </li>
    </ul>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  )
}

export function StepPay({
  reservation,
  onPay,
  onLater,
  paying,
  error,
}: {
  reservation: ReservationView
  onPay: () => void
  onLater: () => void
  paying: boolean
  error: string | null
}) {
  const { t } = useTranslation('reservations')
  const money = (amount: number) =>
    formatCurrency(toMinor(amount), reservation.currency)
  const { table } = reservation
  const nothingToPay = reservation.amountToPayNow <= 0 || !reservation.canPay

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl bg-[#F6F5F6] p-4">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClock aria-hidden className="size-4" />
          {reservation.localDate} {reservation.localTime} -{' '}
          {t('reserve.guests', { count: reservation.partySize })}
        </p>
        <p className="flex items-start gap-2 text-sm">
          <MapPin aria-hidden className="mt-0.5 size-4" />
          <span>
            {t(`reserve.kind.${table.kind}`)} {table.label}
            {table.locationDescription ? ` - ${table.locationDescription}` : ''}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {t('reserve.code', { code: reservation.code })}
        </p>
      </section>

      {reservation.items.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl border border-border bg-white p-4">
          {reservation.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity} x {item.name}
              </span>
              <span>{money(item.totalPrice)}</span>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-4">
        <Row
          label={t('reserve.itemsTotal')}
          value={money(reservation.itemsTotal)}
        />
        {reservation.depositAmount > 0 && (
          <Row
            label={t('reserve.deposit')}
            value={money(reservation.depositAmount)}
          />
        )}
        <Row
          label={t('reserve.payNow')}
          value={money(reservation.amountToPayNow)}
          strong
        />
        <Row
          label={t('reserve.remaining')}
          value={formatCurrency(
            Math.max(
              0,
              toMinor(reservation.amountDue) -
                toMinor(reservation.amountToPayNow),
            ),
            reservation.currency,
          )}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('reserve.policy.title')}</h3>
        <ReservePolicy reservation={reservation} />
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {nothingToPay ? (
        <Button size="lg" className="w-full" onClick={onLater}>
          {t('reserve.viewReservation')}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4">
          <p className="font-semibold">{t('reserve.askPay')}</p>
          <p className="text-sm text-muted-foreground">
            {t('reserve.askPayHint')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={onLater}
              disabled={paying}
            >
              {t('reserve.payLater')}
            </Button>
            <Button size="lg" onClick={onPay} disabled={paying}>
              {t('reserve.payYes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
