import { useMemo } from 'react'
import { DoorClosed, MapPin, Minus, Plus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currentLocale } from '@/i18n'
import { cn } from '@/lib/utils'
import { FloorPlan } from './floor-plan'
import { useGuestReservationFloorQuery } from './reservations-api'
import {
  bookableDates,
  detailsComplete,
  nowInZone,
  timeSlots,
} from './reserve-math'
import type { ReserveDetails } from './reserve-math'
import type { FloorTable, ReservationInfo } from './types'

// Step 1 of the reserve flow: date (inside the booking window), time, party
// size, the live floor to pick a table or cabin, and the guest's name + phone.

function dateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(currentLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function StepDetails({
  info,
  details,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  info: ReservationInfo
  details: ReserveDetails
  onChange: (patch: Partial<ReserveDetails>) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  const { t } = useTranslation('reservations')
  const dates = useMemo(
    () => bookableDates(info.today, info.lastBookableDate),
    [info.today, info.lastBookableDate],
  )
  const slots = useMemo(
    () => timeSlots(details.date === info.today, nowInZone(info.timeZone)),
    [details.date, info.today, info.timeZone],
  )
  const floor = useGuestReservationFloorQuery(
    {
      restaurantId: info.restaurantId,
      date: details.date,
      time: details.time,
      partySize: details.partySize,
    },
    { skip: !details.time, pollingInterval: 30_000 },
  )
  const tables = floor.data?.tables ?? []
  const selected: FloorTable | undefined = tables.find(
    (table) => table.tableId === details.tableId,
  )

  const pick = (table: FloorTable) =>
    onChange({
      tableId: table.tableId === details.tableId ? null : table.tableId,
    })

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (detailsComplete(details)) onSubmit()
      }}
    >
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('reserve.date')}</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              aria-pressed={date === details.date}
              onClick={() => onChange({ date, tableId: null })}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm',
                date === details.date
                  ? 'border-black bg-black text-white'
                  : 'border-border bg-white',
              )}
            >
              {date === info.today ? t('reserve.today') : dateLabel(date)}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reserve-time">{t('reserve.time')}</Label>
          <select
            id="reserve-time"
            value={details.time}
            onChange={(event) =>
              onChange({ time: event.target.value, tableId: null })
            }
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
          >
            <option value="">{t('reserve.chooseTime')}</option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id="party-label">
            {t('reserve.partySize')}
          </span>
          <div
            className="flex h-10 items-center justify-between rounded-xl border border-input bg-white px-1"
            role="group"
            aria-labelledby="party-label"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t('reserve.fewer')}
              disabled={details.partySize <= 1}
              onClick={() => onChange({ partySize: details.partySize - 1 })}
            >
              <Minus aria-hidden />
            </Button>
            <span className="flex items-center gap-1 text-sm font-semibold">
              <Users aria-hidden className="size-4" />
              {details.partySize}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t('reserve.more')}
              disabled={details.partySize >= 50}
              onClick={() => onChange({ partySize: details.partySize + 1 })}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('reserve.pickTable')}</h2>
        {!details.time ? (
          <p className="rounded-2xl bg-[#F6F5F6] p-4 text-sm text-muted-foreground">
            {t('reserve.pickTimeFirst')}
          </p>
        ) : floor.isError ? (
          <p className="text-sm text-destructive">{t('reserve.floorError')}</p>
        ) : (
          <FloorPlan
            tables={tables}
            selectedId={details.tableId}
            onSelect={pick}
          />
        )}
        {selected && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-white p-3">
            {selected.kind === 'CABIN' ? (
              <DoorClosed aria-hidden className="mt-0.5 size-5" />
            ) : (
              <MapPin aria-hidden className="mt-0.5 size-5" />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {t(`reserve.kind.${selected.kind}`)} {selected.label} -{' '}
                {t('reserve.seats', { count: selected.seats })}
              </p>
              {selected.locationDescription && (
                <p className="text-muted-foreground">
                  {selected.locationDescription}
                </p>
              )}
              {!selected.fitsParty && (
                <p className="text-destructive">{t('reserve.tooSmall')}</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-name">{t('reserve.name')}</Label>
          <Input
            id="guest-name"
            autoComplete="name"
            maxLength={100}
            value={details.guestName}
            onChange={(event) => onChange({ guestName: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-phone">{t('reserve.phone')}</Label>
          <Input
            id="guest-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+994 50 123 45 67"
            maxLength={20}
            value={details.guestPhone}
            onChange={(event) => onChange({ guestPhone: event.target.value })}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={
          !detailsComplete(details) ||
          submitting ||
          selected?.fitsParty === false
        }
      >
        {t('reserve.confirm')}
      </Button>
    </form>
  )
}
