import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type {
  ReservationPaymentStatus,
  ReservationStatus,
} from '@/features/reservations/types'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<ReservationStatus, string> = {
  CONFIRMED: 'border-foreground bg-background text-foreground',
  SEATED: 'border-transparent bg-[#08CB00] text-black',
  COMPLETED: 'border-transparent bg-secondary text-secondary-foreground',
  CANCELLED:
    'border-transparent bg-secondary text-muted-foreground line-through',
  NO_SHOW: 'border-transparent bg-destructive text-destructive-foreground',
}

const PAYMENT_CLASS: Record<ReservationPaymentStatus, string> = {
  PAID: 'border-transparent bg-[#08CB00] text-black',
  PARTIALLY_PAID: 'border-foreground bg-background text-foreground',
  UNPAID: 'border-transparent bg-[#0A0A0A] text-white',
}

export function ReservationStatusBadge({
  status,
}: {
  status: ReservationStatus
}) {
  const { t } = useTranslation('adminReservations')
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {t(`staff.status.${status}`)}
    </Badge>
  )
}

export function PaymentStatusBadge({
  status,
}: {
  status: ReservationPaymentStatus
}) {
  const { t } = useTranslation('adminReservations')
  return (
    <Badge variant="outline" className={cn(PAYMENT_CLASS[status])}>
      {t(`staff.payment.${status}`)}
    </Badge>
  )
}
