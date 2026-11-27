import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheckBig, LoaderCircle, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReservationArrivalModal } from './reservation-arrival-modal'
import {
  useCheckInReservationMutation,
  useTableReservationQuery,
} from './reservations-api'
import { readReservationCodes } from './stored-reservation-codes'

// Table page (QR scan): for the reservation codes stored on this phone, ask the
// server whether one belongs to this table and is inside its window; if so, show
// the arrival modal with a check-in button (seats it, pre-orders join the bill).
// The modal shows the table information view first (spec 11.3). A code in the
// link (?reservation=CODE) is probed before the stored ones.

const MAX_PROBES = 5
const CODE_PATTERN = /^[A-Z0-9]{4,12}$/

export function TableArrivalCheck({
  qrToken,
  extraCode,
}: {
  qrToken: string
  extraCode?: string | null
}) {
  const [codes] = useState(() => {
    const fromLink = extraCode?.trim().toUpperCase() ?? ''
    const stored = readReservationCodes()
    const all = CODE_PATTERN.test(fromLink)
      ? [fromLink, ...stored.filter((c) => c !== fromLink)]
      : stored
    return all.slice(0, MAX_PROBES)
  })
  const [shown, setShown] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const onMatch = useCallback((code: string) => setShown((s) => s ?? code), [])
  const onClose = useCallback(() => setDismissed(true), [])
  if (dismissed) return null
  return (
    <>
      {codes.map((code) => (
        <ArrivalProbe
          key={code}
          qrToken={qrToken}
          code={code}
          // Only the first matching reservation gets the modal.
          blocked={shown !== null && shown !== code}
          onMatch={onMatch}
          onClose={onClose}
        />
      ))}
    </>
  )
}

function ArrivalProbe({
  qrToken,
  code,
  blocked,
  onMatch,
  onClose,
}: {
  qrToken: string
  code: string
  blocked: boolean
  onMatch: (code: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('reservations')
  const { data } = useTableReservationQuery({ qrToken, code })
  const [checkIn, checkInState] = useCheckInReservationMutation()

  const reservation = checkInState.data ?? data
  const match =
    !!reservation &&
    (reservation.status === 'CONFIRMED' || reservation.status === 'SEATED')
  useEffect(() => {
    if (match) onMatch(code)
  }, [match, onMatch, code])
  if (!match || blocked || !reservation) return null

  const seated = reservation.status === 'SEATED'
  return (
    <ReservationArrivalModal
      reservation={reservation}
      open
      showLink
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      actions={
        <>
          {seated ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CircleCheckBig className="size-4 text-success" aria-hidden />
              {t('arrival.checkedIn')}
            </p>
          ) : (
            <Button
              className="w-full rounded-xl bg-black text-white hover:bg-black/85"
              disabled={checkInState.isLoading}
              onClick={() => void checkIn({ qrToken, code })}
            >
              {checkInState.isLoading ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <LogIn aria-hidden />
              )}
              {t('arrival.checkIn')}
            </Button>
          )}
          {checkInState.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('arrival.checkInError')}
            </p>
          )}
        </>
      }
    />
  )
}
