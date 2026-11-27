import { useMemo, useState, type ReactNode } from 'react'
import { DoorClosed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { FloorTable } from './types'

// Shared 2D floor (spec section 8): tables are boxes on a square 0..100 grid
// per floor. FREE white with a black border, RESERVED near-black, OCCUPIED
// greige and not selectable, SELECTED / highlighted brand green with black text.
// CABIN gets a thicker border and a door icon. ADMIN imports it read-only.

export interface FloorPlanProps {
  tables: FloorTable[]
  selectedId?: string | null
  highlightId?: string | null
  onSelect?: (table: FloorTable) => void
  size?: 'full' | 'mini'
  /** Staff may select reserved tables (to open the booking). */
  allowReservedSelect?: boolean
  /**
   * Staff only (added by ADMIN, spec section 11): an extra marker on a tile, e.g. an
   * allergy warning, with the text added to the tile's accessible name.
   */
  badge?: (table: FloorTable) => { node: ReactNode; label: string } | null
  className?: string
}

function tableState(
  table: FloorTable,
  selectedId: string | null | undefined,
  highlightId: string | null | undefined,
) {
  if (table.tableId === selectedId || table.tableId === highlightId)
    return 'SELECTED'
  return table.state
}

export function FloorPlan({
  tables,
  selectedId,
  highlightId,
  onSelect,
  size = 'full',
  allowReservedSelect = false,
  badge,
  className,
}: FloorPlanProps) {
  const { t } = useTranslation('reservations')
  const floors = useMemo(
    () =>
      [...new Set(tables.map((table) => table.floor))].sort((a, b) => a - b),
    [tables],
  )
  const focusFloor = tables.find(
    (table) => table.tableId === (selectedId ?? highlightId),
  )?.floor
  const [chosenFloor, setChosenFloor] = useState<number | null>(null)
  const floor = chosenFloor ?? focusFloor ?? floors[0] ?? 1
  const visible = tables.filter((table) => table.floor === floor)
  const mini = size === 'mini'

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {floors.length > 1 && (
        <div
          role="tablist"
          aria-label={t('floor.floors')}
          className="flex gap-2 overflow-x-auto"
        >
          {floors.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === floor}
              onClick={() => setChosenFloor(f)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                f === floor
                  ? 'border-black bg-black text-white'
                  : 'border-border bg-white text-black',
              )}
            >
              {t('floor.floorN', { n: f })}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-[#F6F5F6]',
          mini && 'max-w-xs',
        )}
        data-testid="floor-plan"
      >
        {visible.map((table) => {
          const state = tableState(table, selectedId, highlightId)
          const disabled =
            !onSelect ||
            table.state === 'OCCUPIED' ||
            (table.state === 'RESERVED' && !allowReservedSelect)
          const marker = badge?.(table) ?? null
          const label = [
            table.label,
            t(`floor.state.${table.state}`),
            table.locationDescription,
            marker?.label,
          ]
            .filter(Boolean)
            .join(', ')
          return (
            <button
              key={table.tableId}
              type="button"
              aria-label={label}
              aria-pressed={table.tableId === selectedId}
              title={table.locationDescription ?? undefined}
              disabled={disabled}
              data-state={state}
              onClick={() => onSelect?.(table)}
              style={{
                left: `${table.x}%`,
                top: `${table.y}%`,
                width: `${Math.max(table.w, 4)}%`,
                height: `${Math.max(table.h, 4)}%`,
              }}
              className={cn(
                'absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border text-center font-medium transition-colors disabled:cursor-default',
                mini ? 'text-[10px]' : 'text-xs',
                table.kind === 'CABIN' ? 'border-[3px]' : 'border',
                state === 'FREE' && 'border-black bg-white text-black',
                state === 'RESERVED' &&
                  'border-[#0A0A0A] bg-[#0A0A0A] text-white',
                state === 'OCCUPIED' &&
                  'border-border bg-[#F6F5F6] text-muted-foreground',
                state === 'SELECTED' && 'border-black bg-[#08CB00] text-black',
                !table.fitsParty && state === 'FREE' && 'opacity-50',
              )}
            >
              {table.kind === 'CABIN' && (
                <DoorClosed aria-hidden className="size-3.5" />
              )}
              <span className="truncate px-0.5">{table.label}</span>
              {marker?.node}
            </button>
          )
        })}
      </div>
      {!mini && (
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend
            className="border-black bg-white"
            text={t('floor.state.FREE')}
          />
          <Legend
            className="border-[#0A0A0A] bg-[#0A0A0A]"
            text={t('floor.state.RESERVED')}
          />
          <Legend
            className="border-border bg-[#F6F5F6]"
            text={t('floor.state.OCCUPIED')}
          />
          <Legend
            className="border-black bg-[#08CB00]"
            text={t('floor.state.SELECTED')}
          />
        </ul>
      )}
    </div>
  )
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={cn('size-3 rounded border', className)} />
      {text}
    </li>
  )
}
