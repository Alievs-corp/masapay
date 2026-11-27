import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AdminTable } from '@/features/admin/tables/tables-api'
import type { TableKind, TableLocation } from '@/features/reservations/types'
import { cn } from '@/lib/utils'
import { useUpdateTableLocationSettingsMutation } from './location-rules-api'
import {
  draftOf,
  type LocationDraft,
  locationOf,
  type NumberKey,
  parseLocation,
} from './table-location'
function box(location: TableLocation) {
  return {
    left: `${location.x}%`,
    top: `${location.y}%`,
    width: `${location.w}%`,
    height: `${location.h}%`,
  }
}

/**
 * A small 2D view of one floor: the other tables in white, the edited one in
 * the accent colour. Coordinates are percentages of a square grid.
 */
export function LocationPreview({
  current,
  label,
  others,
}: {
  current: TableLocation | null
  label: string
  others: { id: string; label: string; location: TableLocation }[]
}) {
  const { t } = useTranslation('adminReservations')
  return (
    <div
      role="img"
      aria-label={t('locationForm.previewLabel')}
      className="relative aspect-square w-full overflow-hidden rounded-lg border bg-[#F6F5F6]"
    >
      {others.map((other) => (
        <div
          key={other.id}
          className={cn(
            'absolute flex items-center justify-center overflow-hidden border border-black/20 bg-white text-[10px] text-muted-foreground',
            other.location.kind === 'CABIN' ? 'rounded-sm' : 'rounded-md',
          )}
          style={box(other.location)}
        >
          {other.label}
        </div>
      ))}
      {current && (
        <div
          data-testid="location-preview-current"
          className={cn(
            'absolute flex items-center justify-center overflow-hidden border-2 border-black bg-[#08CB00] text-xs font-semibold text-black',
            current.kind === 'CABIN' ? 'rounded-sm' : 'rounded-md',
          )}
          style={box(current)}
        >
          {label}
        </div>
      )}
    </div>
  )
}

/** Manager dialog that edits where a table is: kind, floor, zone, description, seats and its 2D box. */
export function TableLocationDialog({
  restaurantId,
  table,
  tables,
  onClose,
}: {
  restaurantId: string
  /** The table to edit; null keeps the dialog closed. */
  table: AdminTable | null
  /** All tables of the restaurant, to draw the others on the same floor. */
  tables: AdminTable[]
  onClose: () => void
}) {
  const { t } = useTranslation('adminReservations')
  const [draft, setDraft] = useState<LocationDraft>(() =>
    draftOf(locationOf(table ?? {})),
  )
  const [save, saveState] = useUpdateTableLocationSettingsMutation()

  useEffect(() => {
    if (!table) return
    setDraft(draftOf(locationOf(table)))
    saveState.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  const parsed = parseLocation(draft)
  const floor = parsed?.floor ?? Number(draft.floor)
  const others = tables
    .filter((other) => other.id !== table?.id)
    .map((other) => ({
      id: other.id,
      label: other.label,
      location: locationOf(other),
    }))
    .filter((other) => other.location.floor === floor)

  function set<K extends keyof LocationDraft>(key: K, value: LocationDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!table || !parsed) return
    try {
      await save({ restaurantId, tableId: table.id, location: parsed }).unwrap()
      onClose()
    } catch {
      // saveState.isError is shown below.
    }
  }

  const numberField = (key: NumberKey) => (
    <div className="space-y-1">
      <Label htmlFor={`table-location-${key}`}>
        {t(`locationForm.${key}`)}
      </Label>
      <Input
        id={`table-location-${key}`}
        inputMode="decimal"
        value={draft[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </div>
  )

  return (
    <Dialog open={table !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('locationForm.title')}</DialogTitle>
            <DialogDescription>
              {t('locationForm.description', { label: table?.label ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <ToggleGroup
                type="single"
                value={draft.kind}
                onValueChange={(value) =>
                  value && set('kind', value as TableKind)
                }
                className="grid grid-cols-2 gap-2"
                aria-label={t('locationForm.kind')}
              >
                <ToggleGroupItem value="TABLE">
                  {t('locationForm.kindTable')}
                </ToggleGroupItem>
                <ToggleGroupItem value="CABIN">
                  {t('locationForm.kindCabin')}
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="grid grid-cols-2 gap-2">
                {numberField('floor')}
                {numberField('seats')}
              </div>
              <div className="space-y-1">
                <Label htmlFor="table-location-zone">
                  {t('locationForm.zone')}
                </Label>
                <Input
                  id="table-location-zone"
                  value={draft.zone}
                  maxLength={50}
                  placeholder={t('locationForm.zonePlaceholder')}
                  onChange={(event) => set('zone', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="table-location-description">
                  {t('locationForm.locationDescription')}
                </Label>
                <Textarea
                  id="table-location-description"
                  value={draft.locationDescription}
                  maxLength={255}
                  rows={2}
                  placeholder={t('locationForm.locationPlaceholder')}
                  onChange={(event) =>
                    set('locationDescription', event.target.value)
                  }
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {numberField('x')}
                {numberField('y')}
                {numberField('w')}
                {numberField('h')}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('locationForm.gridHint')}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('locationForm.preview', { floor: draft.floor })}
              </p>
              <LocationPreview
                current={parsed}
                label={table?.label ?? ''}
                others={others}
              />
            </div>
          </div>

          {!parsed && (
            <p className="text-sm text-destructive">
              {t('locationForm.invalid')}
            </p>
          )}
          {saveState.isError && (
            <p className="text-sm text-destructive">
              {t('locationForm.saveFailed')}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('locationForm.cancel')}
            </Button>
            <Button type="submit" disabled={!parsed || saveState.isLoading}>
              {saveState.isLoading
                ? t('locationForm.saving')
                : t('locationForm.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
