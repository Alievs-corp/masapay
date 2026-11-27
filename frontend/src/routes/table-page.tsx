import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { CalendarClock } from 'lucide-react'
import { validateTableToken } from '@/lib/table-session'
import { InvalidTokenPage } from '@/routes/invalid-token-page'
import { BrandMark } from '@/components/layout/brand-mark'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { BillCard } from '@/features/order/bill-card'
import {
  BillError,
  BillSkeleton,
  NoOpenBill,
} from '@/features/order/bill-states'
import { useGetTableOrderQuery } from '@/features/order/order-api'
import { MenuOrderCard } from '@/features/ordering/menu-order-card'
import { PaymentActions } from '@/features/payment/payment-actions'
import { TableArrivalCheck } from '@/features/reservations/table-arrival-check'

// Landing page reached by scanning a table QR code:
//   /r/:restaurantId/t/:tableId?token=<qrToken>
//
// The token gate (4.1) runs first; the live bill then comes from RTK Query
// (4.2) with explicit loading, error and empty states.
export function TablePage() {
  const { t } = useTranslation('customer')
  const { t: tr } = useTranslation('reservations')
  const [searchParams] = useSearchParams()
  const { restaurantSlug } = useParams()
  const token = searchParams.get('token')
  // Optional reservation code in the link (e.g. shared from /reservation/:code).
  const reservationCode = searchParams.get('reservation')
  const validation = useMemo(() => validateTableToken(token), [token])

  const { data, error, isLoading, refetch } = useGetTableOrderQuery(
    validation.valid ? validation.qrToken : skipToken,
  )

  if (!validation.valid) {
    return <InvalidTokenPage reason={validation.reason} />
  }

  let content
  if (isLoading) {
    content = <BillSkeleton />
  } else if (error || !data) {
    const notFound = !!error && 'status' in error && error.status === 404
    content = <BillError notFound={notFound} onRetry={refetch} />
  } else {
    // The menu and the order status as two tabs (#140), the bill and its
    // payment on the Order tab.
    content = (
      <MenuOrderCard
        qrToken={validation.qrToken}
        currency={data.currency}
        restaurantName={data.restaurantName}
        tableLabel={data.tableLabel}
        items={data.order?.items ?? []}
        bill={
          <section
            aria-label={t('tablePage.payment')}
            className="flex w-full flex-col gap-4"
          >
            {data.order ? (
              <>
                <BillCard table={data} order={data.order} />
                <PaymentActions
                  qrToken={validation.qrToken}
                  order={data.order}
                />
              </>
            ) : (
              <NoOpenBill
                tableLabel={data.tableLabel}
                restaurantName={data.restaurantName}
              />
            )}
          </section>
        }
      />
    )
  }

  return (
    // Phone-first: on a wider screen the same phone-width column sits in the
    // middle of a light grey page, so the web looks like the phone.
    <div className="min-h-svh bg-white sm:bg-brand-greige">
      <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col gap-5 bg-white px-4 pb-44 pt-4 sm:shadow-sm">
        {/* The brand (#162 logo, single colour) and the language choice beside it (#215). */}
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base tracking-tight">
            <BrandMark className="h-6" />
            masapay
          </span>
          <LanguageSwitcher className="h-8 rounded-full border-0 bg-brand-greige" />
        </div>
        {content}
        {restaurantSlug && (
          <Link
            to={`/r/${encodeURIComponent(restaurantSlug)}/reserve`}
            className="flex items-center gap-2 self-center rounded-full bg-brand-greige px-4 py-2 text-sm"
          >
            <CalendarClock aria-hidden className="size-4" />
            {tr('tablePage.reserveLink')}
          </Link>
        )}
        {/* A reservation of this guest at this table: arrival view first + check-in. */}
        <TableArrivalCheck
          qrToken={validation.qrToken}
          extraCode={reservationCode}
        />
      </main>
    </div>
  )
}
