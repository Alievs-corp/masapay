import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ReservationArrivalView } from './reservation-arrival-view'
import { tableName } from './reservation-format'
import type { ReservationView } from './types'

// "You have a reservation at this restaurant at <table/cabin>" with the full
// table information view (directions, 2D view, orders, paid / remaining, notes).
// Shown first on the table page when the guest scans the reserved table during
// its window; /reservation/:code shows the same view inline (spec 11.3).
export function ReservationArrivalModal({
  reservation,
  open,
  onOpenChange,
  actions,
  showLink = false,
}: {
  reservation: ReservationView
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Extra buttons (the table page adds the check-in). */
  actions?: React.ReactNode
  showLink?: boolean
}) {
  const { t } = useTranslation('reservations')
  const name = tableName(t, reservation.table)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('arrival.title')}</DialogTitle>
          <DialogDescription>
            {t('arrival.text', { table: name })}
          </DialogDescription>
        </DialogHeader>

        <ReservationArrivalView reservation={reservation} headline={false} />

        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          {actions}
          {showLink && (
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <Link to={`/reservation/${encodeURIComponent(reservation.code)}`}>
                {t('arrival.open')}
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            {t('arrival.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
