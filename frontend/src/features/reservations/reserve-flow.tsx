import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { problemReason } from '@/lib/api-errors'
import { goToPayment } from '@/features/payment/payment-api'
import { BottomTabs, type CustomerTab } from './bottom-tabs'
import {
  useCheckoutReservationMutation,
  useCreateReservationMutation,
  useUpdateReservationItemsMutation,
} from './reservations-api'
import { rememberReservationCode } from './stored-reservation-codes'
import type { ReserveDetails } from './reserve-math'
import { StepDetails } from './step-details'
import { StepMenu, type Preorder } from './step-menu'
import { StepNotes } from './step-notes'
import { StepPay } from './step-pay'
import {
  EMPTY_NOTES_VALUE,
  toNotesRequest,
  type GuestNotesValue,
} from './guest-requests'
import type { ReservationInfo, ReservationView } from './types'

// The reserve flow (user rule 8): details -> notes (special requests,
// allergies; spec 11.1) -> "Add dishes from the menu?"
// yes (pre-order) / no -> "Will you pay now?" yes (existing Payriff flow) /
// no (stays CONFIRMED + UNPAID, see /reservation/:code). The reservation is
// created right after the notes, so the table is held whatever comes next.

export type ReserveStep = 'details' | 'notes' | 'askMenu' | 'menu' | 'pay'

const KNOWN_ERRORS: string[] = [
  'RESERVATION_OVERLAP',
  'OUTSIDE_BOOKING_WINDOW',
  'START_IN_PAST',
  'PARTY_TOO_LARGE',
  'ITEMS_LOCKED',
  'NOTHING_TO_PAY',
  'RESERVATIONS_DISABLED',
]

export function ReserveFlow({
  info,
  onStepChange,
}: {
  info: ReservationInfo
  onStepChange?: (step: ReserveStep, tableLabel: string | null) => void
}) {
  const { t } = useTranslation('reservations')
  const navigate = useNavigate()
  const [step, setStepState] = useState<ReserveStep>('details')
  const [details, setDetails] = useState<ReserveDetails>({
    date: info.today,
    time: '',
    partySize: 2,
    tableId: null,
    guestName: '',
    guestPhone: '',
  })
  const [notes, setNotes] = useState<GuestNotesValue>(EMPTY_NOTES_VALUE)
  const [preorder, setPreorder] = useState<Preorder>({})
  const [reservation, setReservation] = useState<ReservationView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [create, creating] = useCreateReservationMutation()
  const [saveItems, saving] = useUpdateReservationItemsMutation()
  const [checkout, paying] = useCheckoutReservationMutation()

  const setStep = (next: ReserveStep, current = reservation) => {
    setError(null)
    setStepState(next)
    onStepChange?.(next, current?.table.label ?? null)
  }

  const explain = (err: unknown) => {
    const reason = problemReason(err as Parameters<typeof problemReason>[0])
    setError(
      reason && KNOWN_ERRORS.includes(reason)
        ? t(`reserve.errors.${reason}` as 'reserve.errors.generic')
        : t('reserve.errors.generic'),
    )
  }

  const submitDetails = () => {
    if (details.tableId) setStep('notes')
  }

  const createReservation = async (withNotes: GuestNotesValue) => {
    if (!details.tableId) return
    const { note, requests } = toNotesRequest(withNotes)
    try {
      const created = await create({
        restaurantId: info.restaurantId,
        body: {
          tableId: details.tableId,
          date: details.date,
          time: details.time,
          partySize: details.partySize,
          guestName: details.guestName.trim(),
          guestPhone: details.guestPhone.trim(),
          note,
          requests,
        },
      }).unwrap()
      rememberReservationCode(created.code)
      setReservation(created)
      setStep('askMenu', created)
    } catch (err) {
      explain(err)
    }
  }

  const submitItems = async () => {
    if (!reservation) return
    try {
      const updated = await saveItems({
        code: reservation.code,
        items: Object.values(preorder).map((e) => ({
          menuItemId: e.dish.id,
          quantity: e.quantity,
        })),
      }).unwrap()
      setReservation(updated)
      setStep('pay', updated)
    } catch (err) {
      explain(err)
    }
  }

  const pay = async () => {
    if (!reservation) return
    try {
      const started = await checkout({ code: reservation.code }).unwrap()
      goToPayment(started)
    } catch (err) {
      explain(err)
    }
  }

  const later = () => {
    if (reservation)
      navigate(`/reservation/${encodeURIComponent(reservation.code)}`)
  }

  const onTab = (tab: CustomerTab) => {
    if (tab === 'menu' && reservation?.canEditItems) setStep('menu')
    if (tab === 'order') later()
    if (tab === 'reserve' && !reservation && step !== 'details')
      setStep('details')
  }

  return (
    <>
      {step === 'details' && (
        <StepDetails
          info={info}
          details={details}
          onChange={(patch) => setDetails((d) => ({ ...d, ...patch }))}
          onSubmit={submitDetails}
          submitting={false}
          error={error}
        />
      )}

      {step === 'notes' && !reservation && (
        <StepNotes
          value={notes}
          onChange={setNotes}
          onSubmit={() => void createReservation(notes)}
          onSkip={() => {
            setNotes(EMPTY_NOTES_VALUE)
            void createReservation(EMPTY_NOTES_VALUE)
          }}
          onBack={() => setStep('details')}
          submitting={creating.isLoading}
          error={error}
        />
      )}

      {step === 'askMenu' && reservation && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">
            {t('reserve.created', {
              table: reservation.table.label,
              date: reservation.localDate,
              time: reservation.localTime,
            })}
          </p>
          <p className="text-lg font-semibold">{t('reserve.askMenu')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep('pay')}>
              {t('reserve.no')}
            </Button>
            <Button size="lg" onClick={() => setStep('menu')}>
              {t('reserve.yes')}
            </Button>
          </div>
        </section>
      )}

      {step === 'menu' && reservation && (
        <StepMenu
          restaurantId={info.restaurantId}
          date={reservation.localDate}
          currency={info.currency}
          preorder={preorder}
          onChange={setPreorder}
          onDone={submitItems}
          onSkip={() => setStep('pay')}
          allergens={toNotesRequest(notes).requests.allergens}
          saving={saving.isLoading}
          error={error}
        />
      )}

      {step === 'pay' && reservation && (
        <StepPay
          reservation={reservation}
          onPay={pay}
          onLater={later}
          paying={paying.isLoading}
          error={error}
        />
      )}

      <BottomTabs
        active={step === 'menu' ? 'menu' : 'reserve'}
        onSelect={onTab}
        enabled={{
          menu: !!reservation?.canEditItems,
          order: !!reservation,
        }}
      />
    </>
  )
}
