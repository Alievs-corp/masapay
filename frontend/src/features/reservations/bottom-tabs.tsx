import { CalendarClock, ReceiptText, UtensilsCrossed } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// Bottom tab bar of the customer screens: Menu / Order / Reserve. A tab with
// no action is shown disabled (e.g. Order before there is a reservation).

export type CustomerTab = 'menu' | 'order' | 'reserve'

export function BottomTabs({
  active,
  onSelect,
  enabled = { menu: true, order: true, reserve: true },
}: {
  active: CustomerTab
  onSelect: (tab: CustomerTab) => void
  enabled?: Partial<Record<CustomerTab, boolean>>
}) {
  const { t } = useTranslation('reservations')
  const tabs: { key: CustomerTab; icon: ReactNode }[] = [
    { key: 'menu', icon: <UtensilsCrossed aria-hidden className="size-5" /> },
    { key: 'order', icon: <ReceiptText aria-hidden className="size-5" /> },
    { key: 'reserve', icon: <CalendarClock aria-hidden className="size-5" /> },
  ]
  return (
    <nav
      aria-label={t('tabs.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white"
    >
      <ul className="mx-auto grid h-16 max-w-3xl grid-cols-3">
        {tabs.map(({ key, icon }) => (
          <li key={key}>
            <button
              type="button"
              aria-current={key === active ? 'page' : undefined}
              disabled={enabled[key] === false}
              onClick={() => onSelect(key)}
              className={cn(
                'flex size-full flex-col items-center justify-center gap-1 text-xs disabled:opacity-40',
                key === active
                  ? 'font-semibold text-black'
                  : 'text-muted-foreground',
              )}
            >
              {icon}
              {t(`tabs.${key}`)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
