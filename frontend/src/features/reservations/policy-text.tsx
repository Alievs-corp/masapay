import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { formatInstant } from './reservation-format'
import type { ReservationPolicy } from './types'

// The reservation's own rules (copied at booking time): how long it is held and
// what is refunded on cancel or no-show.
export function PolicyText({ policy }: { policy: ReservationPolicy }) {
  const { t } = useTranslation('reservations')
  return (
    <section className="space-y-2 rounded-2xl bg-[#F6F5F6] p-4 text-sm dark:bg-[#0A0A0A]">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4" aria-hidden />
        {t('view.policyTitle')}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>{t('view.policy.valid', { minutes: policy.holdMinutes })}</li>
        <li>
          {t('view.policy.freeCancel', {
            until: formatInstant(policy.freeCancelUntil),
          })}
        </li>
        <li>
          {t('view.policy.lateCancel', {
            percent: policy.lateCancelRefundPercent,
          })}
        </li>
        <li>
          {t('view.policy.noShow', { percent: policy.noShowRefundPercent })}
        </li>
      </ul>
    </section>
  )
}
