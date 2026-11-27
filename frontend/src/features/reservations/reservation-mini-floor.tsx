import { DoorClosed } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FloorTable, ReservationTable } from './types'

// Small 2D view of one floor with the reserved table highlighted in the accent
// colour (0..100 grid, the same drawing rules as the shared floor plan). Read-only.

export function ReservationMiniFloor({
  tables,
  highlight,
  label,
}: {
  tables: FloorTable[]
  highlight: ReservationTable
  label: string
}) {
  const sameFloor = tables.filter((tb) => tb.floor === highlight.floor)
  const all: FloorTable[] = sameFloor.some(
    (tb) => tb.tableId === highlight.tableId,
  )
    ? sameFloor
    : [...sameFloor, { ...highlight, state: 'RESERVED', fitsParty: true }]

  return (
    <div
      role="img"
      aria-label={label}
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/10 bg-[#F6F5F6] dark:border-white/15 dark:bg-[#0A0A0A]"
    >
      {all.map((tb) => {
        const own = tb.tableId === highlight.tableId
        return (
          <div
            key={tb.tableId}
            data-testid={own ? 'mini-floor-highlight' : undefined}
            className={cn(
              'absolute flex items-center justify-center gap-0.5 overflow-hidden rounded-md text-[10px] font-semibold',
              tb.kind === 'CABIN' ? 'border-2' : 'border',
              own
                ? 'z-10 border-black bg-[#08CB00] text-black'
                : tb.state === 'FREE'
                  ? 'border-black/40 bg-white text-black/60 dark:border-white/40 dark:bg-black dark:text-white/60'
                  : 'border-black/20 bg-black/10 text-black/50 dark:border-white/20 dark:bg-white/10 dark:text-white/50',
            )}
            style={{
              left: `${tb.x}%`,
              top: `${tb.y}%`,
              width: `${Math.max(tb.w, 4)}%`,
              height: `${Math.max(tb.h, 4)}%`,
            }}
          >
            {tb.kind === 'CABIN' && (
              <DoorClosed className="size-3 shrink-0" aria-hidden />
            )}
            <span className="truncate">{tb.label}</span>
          </div>
        )
      })}
    </div>
  )
}
