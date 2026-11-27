import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, LoaderCircle, Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useMyRestaurantsQuery } from '@/features/admin/settings/settings-api'
import { formatAmount } from '@/features/admin/transactions/format'
import {
  bakuQuarterHour,
  bakuToday,
} from '@/features/admin/reservations/baku-time'
import { CreateReservationDialog } from '@/features/admin/reservations/create-reservation-dialog'
import {
  PaymentStatusBadge,
  ReservationStatusBadge,
} from '@/features/admin/reservations/reservation-badges'
import { ReservationDetailDialog } from '@/features/admin/reservations/reservation-detail-dialog'
import { RequestBadges } from '@/features/admin/reservations/guest-requests'
import {
  hasAllergy,
  staffRequests,
} from '@/features/admin/reservations/guest-requests-model'
import {
  useDayReservationsQuery,
  useReservationFloorQuery,
} from '@/features/admin/reservations/staff-reservations-api'
import { FloorPlan } from '@/features/reservations/floor-plan'
import type { FloorTable } from '@/features/reservations/types'
import { cn } from '@/lib/utils'

/** Fallback when the WebSocket is down: refetch the day every 30 s (spec section 6). */
const POLL_MS = 30000

// Staff reservations (/admin/reservations): a day's bookings as a list and on the
// 2D floor at a chosen time. Reserved tables are highlighted; unpaid bookings show
// the amount still due. Clicking a booking or a reserved table opens its detail.
export function ReservationsPage() {
  const { t } = useTranslation('adminReservations')
  const restaurants = useMyRestaurantsQuery()
  const [chosen, setChosen] = useState<string | null>(null)
  const restaurantId = chosen ?? restaurants.data?.[0]?.id ?? null
  const [date, setDate] = useState(() => bakuToday())
  const [time, setTime] = useState(() => bakuQuarterHour())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ tableId: string | null } | null>(
    null,
  )

  const day = useDayReservationsQuery(
    { restaurantId: restaurantId ?? '', date },
    { skip: !restaurantId, pollingInterval: POLL_MS },
  )
  const floor = useReservationFloorQuery(
    { restaurantId: restaurantId ?? '', date, time },
    { skip: !restaurantId || !time, pollingInterval: POLL_MS },
  )

  const reservations = [...(day.data ?? [])].sort((a, b) =>
    a.localTime.localeCompare(b.localTime),
  )
  const selected = reservations.find((r) => r.id === selectedId) ?? null

  // A reserved tile whose guest has an allergy gets a warning marker. The staff floor
  // sends the allergies itself; the day list is the fallback.
  function floorBadge(table: FloorTable) {
    const booking = table.reservationId
      ? reservations.find((r) => r.id === table.reservationId)
      : undefined
    const allergic =
      (table.allergies?.length ?? 0) > 0 ||
      (booking !== undefined && hasAllergy(staffRequests(booking)))
    if (!allergic) return null
    return {
      label: t('requests.floorMarker', { table: table.label }),
      node: (
        <span
          data-testid={`allergy-marker-${table.tableId}`}
          className="flex items-center justify-center rounded-full bg-destructive p-0.5 text-destructive-foreground"
        >
          <TriangleAlert aria-hidden className="size-3" />
        </span>
      ),
    }
  }

  function onTable(table: FloorTable) {
    if (table.reservationId) setSelectedId(table.reservationId)
    else if (table.state === 'FREE') setCreating({ tableId: table.tableId })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarClock aria-hidden className="size-6" />
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('staff.subtitle')}</p>
        </div>
        <Button
          onClick={() => setCreating({ tableId: null })}
          disabled={!restaurantId || !floor.data}
        >
          <Plus className="size-4" aria-hidden />
          {t('staff.actions.create')}
        </Button>
      </header>

      {restaurants.data && restaurants.data.length > 1 && (
        <ToggleGroup
          type="single"
          value={restaurantId ?? undefined}
          onValueChange={(value) => value && setChosen(value)}
          className="flex-wrap justify-start"
        >
          {restaurants.data.map((restaurant) => (
            <ToggleGroupItem key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="resv-day">{t('staff.date')}</Label>
          <Input
            id="resv-day"
            type="date"
            value={date}
            onChange={(event) =>
              event.target.value && setDate(event.target.value)
            }
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resv-floor-time">{t('staff.floorTime')}</Label>
          <Input
            id="resv-floor-time"
            type="time"
            value={time}
            onChange={(event) =>
              event.target.value && setTime(event.target.value)
            }
            className="w-32"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label={t('staff.floorLabel')} className="space-y-3">
          <h2 className="text-lg font-semibold">{t('staff.floorLabel')}</h2>
          {floor.isLoading && (
            <LoaderCircle
              className="size-6 animate-spin text-muted-foreground"
              aria-label={t('staff.loading')}
            />
          )}
          {floor.isError && (
            <p className="text-sm text-destructive">{t('staff.loadError')}</p>
          )}
          {floor.data && floor.data.tables.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('staff.noTables')}
            </p>
          )}
          {floor.data && floor.data.tables.length > 0 && (
            <FloorPlan
              tables={floor.data.tables}
              selectedId={selected?.table.tableId ?? null}
              onSelect={onTable}
              allowReservedSelect
              badge={floorBadge}
              size="full"
            />
          )}
        </section>

        <section aria-label={t('staff.listLabel')} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {t('staff.listLabel')}
            {day.data && (
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                {reservations.length}
              </span>
            )}
          </h2>
          {day.isLoading && (
            <LoaderCircle
              className="size-6 animate-spin text-muted-foreground"
              aria-label={t('staff.loading')}
            />
          )}
          {day.isError && (
            <p className="text-sm text-destructive">{t('staff.loadError')}</p>
          )}
          {day.data && reservations.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('staff.empty')}</p>
          )}
          <ul className="space-y-2">
            {reservations.map((reservation) => {
              const unpaid =
                reservation.paymentStatus !== 'PAID' &&
                reservation.remaining > 0
              return (
                <li key={reservation.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(reservation.id)}
                    className={cn(
                      'w-full space-y-2 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-[#F6F5F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectedId === reservation.id && 'border-foreground',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          <span className="tabular-nums">
                            {reservation.localTime}
                          </span>{' '}
                          {reservation.guestName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('staff.row', {
                            table: reservation.table.label,
                            count: reservation.partySize,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <ReservationStatusBadge status={reservation.status} />
                        <PaymentStatusBadge
                          status={reservation.paymentStatus}
                        />
                      </div>
                    </div>
                    <RequestBadges requests={staffRequests(reservation)} />
                    {unpaid && (
                      <p className="text-sm font-semibold">
                        {t('staff.detail.amountDue', {
                          amount: formatAmount(
                            reservation.remaining,
                            reservation.currency,
                          ),
                        })}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {selected && restaurantId && (
        <ReservationDetailDialog
          key={selected.id}
          restaurantId={restaurantId}
          reservation={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
      {creating && restaurantId && floor.data && (
        <CreateReservationDialog
          restaurantId={restaurantId}
          tables={floor.data.tables}
          date={date}
          time={time}
          tableId={creating.tableId}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  )
}
