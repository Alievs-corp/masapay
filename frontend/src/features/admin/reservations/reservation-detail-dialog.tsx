import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, Check, CircleCheckBig, LoaderCircle, UserX } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatAmount } from '@/features/admin/transactions/format'
import type { ReservationView } from '@/features/reservations/types'
import { problemReason } from '@/lib/api-errors'
import {
  useCancelReservationMutation,
  useCompleteReservationMutation,
  useNoShowReservationMutation,
  useSeatReservationMutation,
} from './staff-reservations-api'
import {
  PaymentStatusBadge,
  ReservationStatusBadge,
} from './reservation-badges'
import { availableActions, type ReservationAction } from './reservation-actions'
import { GuestRequestsSection } from './guest-requests'
import { staffRequests } from './guest-requests-model'

const ACTION_ICON = {
  seat: Check,
  complete: CircleCheckBig,
  cancel: Ban,
  noShow: UserX,
} as const

interface Props {
  restaurantId: string
  reservation: ReservationView
  onClose: () => void
}

// One reservation as staff see it: guest, time, table, pre-ordered dishes, what is
// paid and what is still due, and the actions its status allows (each confirmed first).
export function ReservationDetailDialog({
  restaurantId,
  reservation,
  onClose,
}: Props) {
  const { t } = useTranslation('adminReservations')
  const role = useAppSelector((state) => state.auth.user?.role)
  const isManager = role === 'SUPER_ADMIN' || role === 'RESTO_MANAGER'
  const [pending, setPending] = useState<ReservationAction | null>(null)
  const [reason, setReason] = useState('')
  const [fullRefund, setFullRefund] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Payriff refused the policy refund on cancel / no-show: staff must refund by hand.
  const [refundFailed, setRefundFailed] = useState(false)
  const [seat, seatState] = useSeatReservationMutation()
  const [complete, completeState] = useCompleteReservationMutation()
  const [cancel, cancelState] = useCancelReservationMutation()
  const [noShow, noShowState] = useNoShowReservationMutation()
  const busy =
    seatState.isLoading ||
    completeState.isLoading ||
    cancelState.isLoading ||
    noShowState.isLoading

  const money = (amount: number) => formatAmount(amount, reservation.currency)
  const args = { restaurantId, id: reservation.id }
  const unpaid =
    reservation.paymentStatus !== 'PAID' && reservation.remaining > 0

  function closeConfirm() {
    setPending(null)
    setReason('')
    setFullRefund(false)
  }

  async function confirm() {
    if (!pending) return
    setError(null)
    try {
      let result: ReservationView
      if (pending === 'seat') result = await seat(args).unwrap()
      else if (pending === 'complete') result = await complete(args).unwrap()
      else if (pending === 'noShow') result = await noShow(args).unwrap()
      else
        result = await cancel({
          ...args,
          body: {
            reason: reason.trim() || undefined,
            fullRefund: isManager && fullRefund ? true : undefined,
          },
        }).unwrap()
      closeConfirm()
      if (result.refundError) {
        // Keep the dialog open so the warning is seen.
        setRefundFailed(true)
        return
      }
      onClose()
    } catch (caught) {
      const code = problemReason(caught as Parameters<typeof problemReason>[0])
      setError(
        code ? t('staff.errors.withCode', { code }) : t('staff.errors.action'),
      )
      closeConfirm()
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reservation.guestName}
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {reservation.code}
              </span>
            </DialogTitle>
            <DialogDescription>
              {t('staff.detail.when', {
                date: reservation.localDate,
                time: reservation.localTime,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <ReservationStatusBadge status={reservation.status} />
            <PaymentStatusBadge status={reservation.paymentStatus} />
          </div>

          {unpaid && (
            <p className="rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-medium text-white">
              {t('staff.detail.amountDue', {
                amount: money(reservation.remaining),
              })}
            </p>
          )}

          <GuestRequestsSection requests={staffRequests(reservation)} />

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('staff.detail.phone')}</dt>
            <dd>
              <a
                className="underline-offset-4 hover:underline"
                href={`tel:${reservation.guestPhone}`}
              >
                {reservation.guestPhone}
              </a>
            </dd>
            <dt className="text-muted-foreground">{t('staff.detail.party')}</dt>
            <dd>{reservation.partySize}</dd>
            <dt className="text-muted-foreground">{t('staff.detail.table')}</dt>
            <dd>
              {reservation.table.label}
              {reservation.table.kind === 'CABIN' &&
                ` (${t('staff.kind.CABIN')})`}
              {reservation.table.locationDescription && (
                <span className="block text-muted-foreground">
                  {reservation.table.locationDescription}
                </span>
              )}
            </dd>
            {reservation.note && (
              <>
                <dt className="text-muted-foreground">
                  {t('staff.detail.note')}
                </dt>
                <dd>{reservation.note}</dd>
              </>
            )}
          </dl>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('staff.detail.items')}</h3>
            {reservation.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('staff.detail.noItems')}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {reservation.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-2 px-3 py-2"
                  >
                    <span>
                      {item.quantity} x {item.name}
                    </span>
                    <span className="tabular-nums">
                      {money(item.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt>{t('staff.detail.itemsTotal')}</dt>
              <dd className="tabular-nums">{money(reservation.itemsTotal)}</dd>
              <dt>{t('staff.detail.paid')}</dt>
              <dd className="tabular-nums">{money(reservation.paidAmount)}</dd>
              {reservation.refundedAmount > 0 && (
                <>
                  <dt>{t('staff.detail.refunded')}</dt>
                  <dd className="tabular-nums">
                    {money(reservation.refundedAmount)}
                  </dd>
                </>
              )}
              <dt className="font-semibold">{t('staff.detail.remaining')}</dt>
              <dd className="font-semibold tabular-nums">
                {money(reservation.remaining)}
              </dd>
            </dl>
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {refundFailed && (
            <p
              role="alert"
              className="rounded-lg border-2 border-destructive px-3 py-2 text-sm font-medium"
            >
              {t('refund.failed')}
            </p>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            {availableActions(reservation).map((action) => {
              const Icon = ACTION_ICON[action]
              return (
                <Button
                  key={action}
                  variant={
                    action === 'cancel' || action === 'noShow'
                      ? 'outline'
                      : 'default'
                  }
                  disabled={busy}
                  onClick={() => setPending(action)}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`staff.actions.${action}`)}
                </Button>
              )
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && closeConfirm()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending && t(`staff.confirm.${pending}.title`)}
            </DialogTitle>
            <DialogDescription>
              {pending && t(`staff.confirm.${pending}.body`)}
            </DialogDescription>
          </DialogHeader>
          {pending === 'cancel' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cancel-reason">
                  {t('staff.confirm.reason')}
                </Label>
                <Textarea
                  id="cancel-reason"
                  value={reason}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              {isManager && reservation.paidAmount > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fullRefund}
                    onChange={(event) => setFullRefund(event.target.checked)}
                  />
                  {t('staff.confirm.fullRefund')}
                </label>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeConfirm} disabled={busy}>
              {t('staff.confirm.back')}
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy && (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              )}
              {t('staff.confirm.yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
