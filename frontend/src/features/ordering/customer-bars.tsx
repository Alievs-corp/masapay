import { ArrowRight, ReceiptText, UtensilsCrossed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/features/order/format'
import { cn } from '@/lib/utils'

// The bottom of the table screen: a black checkout bar while the basket has
// something in it, and under it the Menu / Order tab bar. Both stay at phone
// width on a desktop too, so the web looks the same as the phone.

export type CustomerScreen = 'menu' | 'order'

export function CustomerBars({
  screen,
  onScreen,
  count,
  total,
  currency,
  onCheckout,
}: {
  screen: CustomerScreen
  onScreen: (screen: CustomerScreen) => void
  count: number
  /** Basket total in minor units. */
  total: number
  currency: string
  onCheckout: () => void
}) {
  const { t } = useTranslation('customer')
  const tabs = [
    { key: 'menu' as const, Icon: UtensilsCrossed },
    { key: 'order' as const, Icon: ReceiptText },
  ]
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px]">
      {count > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-brand-near-black px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-sm">
              {t('checkout.items', { count })}
              <span className="text-white/60"> · </span>
              <span className="tabular-nums">
                {formatCurrency(total, currency)}
              </span>
            </p>
            <p className="truncate text-xs text-white/60">
              {t('checkout.ready')}
            </p>
          </div>
          <Button
            variant="ghost"
            className="h-10 shrink-0 bg-white px-5 text-black hover:bg-white/90 hover:text-black"
            onClick={onCheckout}
            aria-label={t('menuOrder.confirm', {
              amount: formatCurrency(total, currency),
            })}
          >
            {t('checkout.submit')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
      <nav
        aria-label={t('checkout.tabs')}
        className="border-t border-border bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid h-16 grid-cols-2">
          {tabs.map(({ key, Icon }) => {
            const selected = key === screen
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => onScreen(key)}
                  className={cn(
                    'flex size-full flex-col items-center justify-center gap-1 text-xs transition-colors',
                    selected ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" aria-hidden />
                    {key === 'order' && count > 0 && (
                      <span
                        aria-hidden
                        className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-near-black px-1 text-[10px] text-white"
                      >
                        {count}
                      </span>
                    )}
                  </span>
                  {t(`checkout.${key}`)}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
