import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  CalendarClock,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  MapPin,
  RotateCw,
  Users,
  XCircle,
} from 'lucide-react'
import { BrandMark } from '@/components/layout/brand-mark'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/features/order/format'
import { toMinor } from '@/features/order/order-api'
import { goToPayment } from '@/features/payment/payment-api'
import {
  useCheckoutReservationMutation,
  useGuestCancelReservationMutation,
  useReservationQuery,
} from '@/features/reservations/reservations-api'
import { rememberReservationCode } from '@/features/reservations/stored-reservation-codes'
import { PolicyText } from '@/features/reservations/policy-text'
import { ReservationArrivalView } from '@/features/reservations/reservation-arrival-view'
import { ReservationMiniFloor } from '@/features/reservations/reservation-mini-floor'
import { ReservationNotesSection } from '@/features/reservations/reservation-notes-section'
import { ReservationCountdown } from '@/features/reservations/reservation-countdown'
import {
  formatLocalDate,
  money,
  tableName,
} from '@/features/reservations/reservation-format'
import { useArrivalPhase } from '@/features/reservations/arrival-phase'
import type {
  ReservationPaymentStatus,
  ReservationStatus,
  ReservationView,
} from '@/features/reservations/types'
import { cn } from '@/lib/utils'

// /reservation/:code: the guest's reservation (date, time, table and where it is,
// pre-ordered dishes, paid / remaining, notes, policy, status), a pay-later
// button and a mini floor plan. Polls every 20 s. By phase (spec 11.3): before
// the start a countdown + details + notes editor; from the start until the hold
// ends (or while seated) the table information view opens directly at the top;
// afterwards only the status.

const POLL_MS = 20_000

const STATUS_TONE: Record<ReservationStatus, string> = {
  CONFIRMED: 'bg-[#08CB00] text-black',
  SEATED: 'bg-black text-white dark:bg-white dark:text-black',
  COMPLETED: 'bg-[#F6F5F6] text-black dark:bg-[#0A0A0A] dark:text-white',
  CANCELLED: 'bg-destructive/10 text-destructive',
  NO_SHOW: 'bg-destructive/10 text-destructive',
}

const PAYMENT_TONE: Record<ReservationPaymentStatus, string> = {
  PAID: 'border-[#08CB00] text-foreground',
  PARTIALLY_PAID: 'border-black/30 text-foreground dark:border-white/30',
  UNPAID: 'border-destructive text-destructive',
}

export function ReservationPage() {
  const { t } = useTranslation('reservations')
  const { code = '' } = useParams()
  const query = useReservationQuery(code || skipToken, {
    pollingInterval: POLL_MS,
  })

  useEffect(() => {
    if (query.data) rememberReservationCode(query.data.code)
  }, [query.data])

  let content
  if (query.isLoading) {
    content = (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  } else if (!query.data) {
    const notFound =
      !!query.error && 'status' in query.error && query.error.status === 404
    content = (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#F6F5F6] p-6 text-center dark:bg-[#0A0A0A]">
        <CircleAlert className="size-8 text-destructive" aria-hidden />
        <p className="font-semibold">
          {notFound ? t('view.notFound') : t('view.loadError')}
        </p>
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            {t('view.notFoundText')}
          </p>
        ) : (
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RotateCw aria-hidden />
            {t('view.retry')}
          </Button>
        )}
      </div>
    )
  } else {
    content = <ReservationDetails reservation={query.data} />
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 bg-white p-4 sm:max-w-2xl sm:p-6 dark:bg-black">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-lg tracking-tight">
          <BrandMark className="h-7" />
          masapay
        </span>
        <LanguageSwitcher />
      </div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <CalendarClock aria-hidden className="size-6" />
        {t('view.title')}
      </h1>
      {content}
    </main>
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
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', strong && 'font-semibold')}>
        {value}
      </span>
    </div>
  )
}

export function ReservationDetails({
  reservation: r,
}: {
  reservation: ReservationView
}) {
  const { t } = useTranslation('reservations')
  const [checkout, checkoutState] = useCheckoutReservationMutation()
  const [cancel, cancelState] = useGuestCancelReservationMutation()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const active = r.status === 'CONFIRMED' || r.status === 'SEATED'
  // Server time minus device time, taken when a response arrives.
  const skewMs = useMemo(() => {
    const server = r.serverNow ? Date.parse(r.serverNow) : NaN
    return Number.isNaN(server) ? 0 : server - Date.now()
  }, [r.serverNow])
  const { phase, now } = useArrivalPhase(r, skewMs)
  const arrival = phase === 'ARRIVAL'
  const name = tableName(t, r.table)

  // In minor units (integers): no float math on money. The server's
  // amountToPayNow is already net of what was paid and capped by the remaining
  // amount (spec 11.4), so it is shown as is.
  const remainingMinor = toMinor(r.remaining)
  const payNowMinor = Math.min(
    Math.max(toMinor(r.amountToPayNow), 0),
    remainingMinor,
  )
  const pay = async (payFull: boolean) => {
    try {
      // When "pay now" already covers everything left, ask for the full rest so
      // the server charges exactly what the button shows.
      const full = payFull || payNowMinor >= remainingMinor
      goToPayment(await checkout({ code: r.code, payFull: full }).unwrap())
    } catch {
      // The error text below explains it; the reservation stays confirmed.
    }
  }

  return (
    <div className="space-y-4">
      {arrival && <ReservationArrivalView reservation={r} />}
      {phase === 'UPCOMING' && active && (
        <ReservationCountdown startsAt={r.startsAt} now={now} />
      )}
      {phase === 'ENDED' && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl bg-[#F6F5F6] p-4 dark:bg-[#0A0A0A]"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">
              {t('arrivalView.endedTitle')} · {t(`view.status.${r.status}`)}
            </p>
            {r.status === 'CONFIRMED' && (
              <p className="text-muted-foreground">
                {t('arrivalView.expiredText')}
              </p>
            )}
          </div>
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t('view.code', { code: r.code })}
          </p>
          <div className="flex gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                STATUS_TONE[r.status],
              )}
            >
              {t(`view.status.${r.status}`)}
            </span>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                PAYMENT_TONE[r.paymentStatus],
              )}
            >
              {t(`view.paymentStatus.${r.paymentStatus}`)}
            </span>
          </div>
        </div>
        <p className="text-lg font-semibold">{r.restaurantName}</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-[#F6F5F6] p-3 dark:bg-[#0A0A0A]">
            <p className="text-xs text-muted-foreground">{t('view.date')}</p>
            <p className="font-semibold">{formatLocalDate(r.localDate)}</p>
          </div>
          <div className="rounded-xl bg-[#F6F5F6] p-3 dark:bg-[#0A0A0A]">
            <p className="text-xs text-muted-foreground">{t('view.time')}</p>
            <p className="font-semibold tabular-nums">{r.localTime}</p>
          </div>
          <div className="rounded-xl bg-[#F6F5F6] p-3 dark:bg-[#0A0A0A]">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" aria-hidden />
              {t('view.party')}
            </p>
            <p className="font-semibold tabular-nums">{r.partySize}</p>
          </div>
        </div>
        {/* In the arrival phase the table view above already shows where it is. */}
        {!arrival && (
          <>
            <div className="flex gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {name} · {t('view.floor', { floor: r.table.floor })}
                  {r.table.zone ? ` · ${r.table.zone}` : ''}
                </p>
                {r.table.locationDescription && (
                  <p className="text-muted-foreground">
                    {r.table.locationDescription}
                  </p>
                )}
              </div>
            </div>
            <ReservationMiniFloor
              tables={r.floorTables}
              highlight={r.table}
              label={t('view.mapLabel', { table: name })}
            />
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <h2 className="font-semibold">{t('view.items')}</h2>
        {arrival ? null : r.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('view.noItems')}</p>
        ) : (
          <ul className="space-y-2">
            {r.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F5F6] px-3 py-2 text-sm dark:bg-[#0A0A0A]"
              >
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
        <div className="space-y-1 border-t border-black/10 pt-3 dark:border-white/15">
          <Row
            label={t('view.amountDue')}
            value={money(r.amountDue, r.currency)}
          />
          <Row label={t('view.paid')} value={money(r.paidAmount, r.currency)} />
          {r.refundedAmount > 0 && (
            <Row
              label={t('view.refunded')}
              value={money(r.refundedAmount, r.currency)}
            />
          )}
          <Row
            label={t('view.remaining')}
            value={money(r.remaining, r.currency)}
            strong
          />
        </div>
        {r.paymentStatus === 'UNPAID' && r.amountDue > 0 && active && (
          <p className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
            {t('view.unpaidNote')}
          </p>
        )}
        {r.canPay && r.remaining > 0 && (
          <div className="space-y-2">
            {payNowMinor > 0 && (
              <Button
                className="h-12 w-full rounded-xl bg-black text-white hover:bg-black/85"
                disabled={checkoutState.isLoading}
                onClick={() => void pay(false)}
              >
                {checkoutState.isLoading ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <CreditCard aria-hidden />
                )}
                {t('view.payNow')} · {formatCurrency(payNowMinor, r.currency)}
              </Button>
            )}
            {remainingMinor > payNowMinor && (
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl"
                disabled={checkoutState.isLoading}
                onClick={() => void pay(true)}
              >
                {t('view.payFull')} · {money(r.remaining, r.currency)}
              </Button>
            )}
            {checkoutState.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t('view.payError')}
              </p>
            )}
          </div>
        )}
      </section>

      {!arrival && <ReservationNotesSection reservation={r} phase={phase} />}

      <PolicyText policy={r.policy} />

      {r.canCancel && (
        <section className="space-y-2">
          {confirmCancel ? (
            <div className="space-y-2 rounded-2xl border border-destructive/40 p-4">
              <p className="text-sm">{t('view.cancelConfirm')}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl"
                  disabled={cancelState.isLoading}
                  onClick={() => {
                    void cancel({ code: r.code })
                      .unwrap()
                      .then(() => setConfirmCancel(false))
                      .catch(() => undefined)
                  }}
                >
                  {t('view.cancel')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setConfirmCancel(false)}
                >
                  {t('view.cancelKeep')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle aria-hidden />
              {t('view.cancel')}
            </Button>
          )}
          {cancelState.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('view.cancelError')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
