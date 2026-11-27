import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ReserveFlow } from '@/features/reservations/reserve-flow'
import { useReservationInfoQuery } from '@/features/reservations/reservations-api'

// /r/:restaurantSlug/reserve: the guest books a table or cabin, optionally
// pre-orders and pays (docs/RESERVATIONS-SPEC.md). restaurantSlug is the
// restaurant id, as in the table QR URLs. Mobile first, centered on desktop.
export function ReservePage() {
  const { t } = useTranslation('reservations')
  const { restaurantSlug = '' } = useParams()
  const info = useReservationInfoQuery(restaurantSlug, {
    skip: !restaurantSlug,
  })
  const [tableLabel, setTableLabel] = useState<string | null>(null)

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl bg-white px-4 pb-24 pt-4">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarClock aria-hidden className="size-6" />
            {t('page.title')}
          </h1>
          {info.data && (
            <p className="text-sm text-muted-foreground">
              {info.data.restaurantName}
            </p>
          )}
        </div>
        {tableLabel && (
          <span className="shrink-0 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
            {t('reserve.tableBadge', { label: tableLabel })}
          </span>
        )}
      </header>

      {info.isLoading && (
        <p className="text-sm text-muted-foreground">{t('reserve.loading')}</p>
      )}
      {info.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('reserve.infoError')}
        </p>
      )}
      {info.data && !info.data.rules.enabled && (
        <p className="rounded-2xl bg-[#F6F5F6] p-4 text-sm">
          {t('reserve.disabled')}
        </p>
      )}
      {info.data?.rules.enabled && (
        <ReserveFlow
          info={info.data}
          onStepChange={(_step, label) => setTableLabel(label)}
        />
      )}
    </main>
  )
}
