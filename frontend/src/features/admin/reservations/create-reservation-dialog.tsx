import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FloorTable } from '@/features/reservations/types'
import {
  EMPTY_NOTES_VALUE,
  toNotesRequest,
  type GuestNotesValue,
} from '@/features/reservations/guest-requests'
import { GuestRequestsForm } from '@/features/reservations/guest-requests-form'
import { problemReason } from '@/lib/api-errors'
import { useCreateStaffReservationMutation } from './staff-reservations-api'

interface Props {
  restaurantId: string
  tables: FloorTable[]
  date: string
  time: string
  tableId?: string | null
  onClose: () => void
}

// A phone booking by staff: any date (no customer booking window), any table.
// The server still rejects overlaps and party sizes above the table's seats.
export function CreateReservationDialog({
  restaurantId,
  tables,
  date: initialDate,
  time: initialTime,
  tableId: initialTable,
  onClose,
}: Props) {
  const { t } = useTranslation('adminReservations')
  const [create, { isLoading }] = useCreateStaffReservationMutation()
  const [tableId, setTableId] = useState(
    initialTable ?? tables[0]?.tableId ?? '',
  )
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [partySize, setPartySize] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  // Phone bookings record the same requests and allergies a guest picks online.
  const [notes, setNotes] = useState<GuestNotesValue>(EMPTY_NOTES_VALUE)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await create({
        restaurantId,
        body: {
          tableId,
          date,
          time,
          partySize,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          ...toNotesRequest(notes),
        },
      }).unwrap()
      onClose()
    } catch (caught) {
      const code = problemReason(caught as Parameters<typeof problemReason>[0])
      const known = [
        'RESERVATION_OVERLAP',
        'PARTY_TOO_LARGE',
        'START_IN_PAST',
      ] as const
      const knownCode = known.find((reason) => reason === code)
      setError(
        knownCode
          ? t(`staff.errors.${knownCode}`)
          : code
            ? t('staff.errors.withCode', { code })
            : t('staff.errors.action'),
      )
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('staff.create.title')}</DialogTitle>
          <DialogDescription>{t('staff.create.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="resv-table">{t('staff.create.table')}</Label>
            <select
              id="resv-table"
              required
              value={tableId}
              onChange={(event) => setTableId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {tables.map((table) => (
                <option key={table.tableId} value={table.tableId}>
                  {table.label} ({t(`staff.kind.${table.kind}`)},{' '}
                  {t('staff.create.seats', { count: table.seats })})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="resv-date">{t('staff.create.date')}</Label>
              <Input
                id="resv-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resv-time">{t('staff.create.time')}</Label>
              <Input
                id="resv-time"
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resv-party">{t('staff.create.party')}</Label>
            <Input
              id="resv-party"
              type="number"
              min={1}
              max={50}
              required
              value={partySize}
              onChange={(event) => setPartySize(Number(event.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resv-name">{t('staff.create.name')}</Label>
            <Input
              id="resv-name"
              required
              maxLength={120}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resv-phone">{t('staff.create.phone')}</Label>
            <Input
              id="resv-phone"
              type="tel"
              required
              maxLength={30}
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
            />
          </div>
          <GuestRequestsForm
            value={notes}
            onChange={setNotes}
            idPrefix="staff-resv"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('staff.confirm.back')}
            </Button>
            <Button type="submit" disabled={isLoading || !tableId}>
              {isLoading && (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              )}
              {t('staff.create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
