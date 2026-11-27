import { Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countdownTo } from './arrival-phase'
import { formatInstant } from './reservation-format'

// "Your reservation starts in 1 h 12 min 5 s" before the start time (spec 11.3).
// `now` comes from useArrivalPhase, which ticks every second.
export function ReservationCountdown({
  startsAt,
  now,
}: {
  startsAt: string
  now: number
}) {
  const { t } = useTranslation('reservations')
  const left = countdownTo(startsAt, now)
  const text =
    left.days > 0
      ? t('arrivalView.countdownDays', { ...left })
      : left.hours > 0
        ? t('arrivalView.countdownHours', { ...left })
        : t('arrivalView.countdownMinutes', { ...left })
  return (
    <div
      role="timer"
      aria-live="off"
      className="flex items-center gap-3 rounded-2xl bg-[#0A0A0A] p-4 text-white"
    >
      <Timer aria-hidden className="size-6 shrink-0" />
      <div>
        <p className="text-xs text-white/70">{t('arrivalView.startsIn')}</p>
        <p
          className="text-xl font-semibold tabular-nums"
          data-testid="countdown"
        >
          {text}
        </p>
        <p className="text-xs text-white/70">{formatInstant(startsAt)}</p>
      </div>
    </div>
  )
}
