import type { ReactNode } from 'react'
import { CircleCheckBig, Plus, ShoppingBasket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/features/order/format'
import { KitchenStatusBadge } from '@/features/order/kitchen-status-badge'
import type { OrderItem } from '@/features/order/types'
import { cn } from '@/lib/utils'
import type { CustomerDish } from './customer-menu-api'
import { DishPicture, Stepper } from './dish-card'
import type { BasketEntry } from './use-basket'

// The "Order" tab of the table screen: the basket before confirming (Cart),
// the confirmed dishes still in the kitchen (In progress) and the ones that
// are ready (Done). The live bill and its payment sit under the last two.

export type OrderSubTab = 'cart' | 'progress' | 'done'

const SUB_TABS: OrderSubTab[] = ['cart', 'progress', 'done']

function inProgress(item: OrderItem) {
  return item.kitchenStatus === 'NEW' || item.kitchenStatus === 'PREPARING'
}

export function OrderPanel({
  sub,
  onSub,
  entries,
  count,
  currency,
  items,
  justOrdered,
  onChange,
  onNewRound,
  bill,
}: {
  sub: OrderSubTab
  onSub: (sub: OrderSubTab) => void
  entries: BasketEntry[]
  count: number
  currency: string
  /** Lines of the table's open bill, if there is one. */
  items: OrderItem[]
  justOrdered: boolean
  onChange: (dish: CustomerDish, delta: number) => void
  onNewRound: () => void
  bill?: ReactNode
}) {
  const { t } = useTranslation('customer')
  const shownLines = items.filter((item) =>
    sub === 'progress' ? inProgress(item) : !inProgress(item),
  )

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={t('orderPanel.label')}
        className="grid grid-cols-3 border-b border-border"
      >
        {SUB_TABS.map((key) => {
          const selected = key === sub
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSub(key)}
              className={cn(
                '-mb-px flex h-11 items-center justify-center gap-1.5 border-b-2 text-sm transition-colors',
                selected
                  ? 'border-brand-near-black text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`orderPanel.${key}`)}
              {key === 'cart' && count > 0 && (
                <span
                  aria-hidden
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-near-black px-1.5 text-[11px] text-white"
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {justOrdered && sub !== 'cart' && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl bg-brand-near-black p-4 text-white"
        >
          <p className="flex items-center gap-3 text-sm">
            <CircleCheckBig
              className="size-5 shrink-0 text-brand-green"
              aria-hidden
            />
            {t('menuOrder.ordered')}
          </p>
        </div>
      )}

      {sub === 'cart' ? (
        <section aria-label={t('menuOrder.basket')} className="space-y-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-brand-greige px-4 py-10 text-center">
              <ShoppingBasket
                className="size-6 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                {t('menuBrowser.nothingPicked')}
              </p>
              <Button size="sm" onClick={onNewRound}>
                {t('orderPanel.toMenu')}
              </Button>
            </div>
          ) : (
            <ul aria-label={t('menuOrder.basket')} className="space-y-3">
              {entries.map(({ dish, quantity }) => (
                <li
                  key={dish.id}
                  className="flex items-center gap-3 rounded-2xl bg-brand-greige p-3"
                >
                  <DishPicture dish={dish} className="size-16 rounded-xl" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate text-sm">{dish.name}</span>
                    <span className="block text-base tabular-nums">
                      {formatCurrency(dish.price * quantity, currency)}
                    </span>
                  </span>
                  <Stepper
                    quantity={quantity}
                    onChange={(delta) => onChange(dish, delta)}
                    decreaseLabel={t('menuBrowser.decreasePickedAria', {
                      name: dish.name,
                    })}
                    increaseLabel={t('menuBrowser.increasePickedAria', {
                      name: dish.name,
                    })}
                    quantityLabel={t('dish.quantityAria', { name: dish.name })}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {t('menuOrder.cancelHint')}
          </p>
        </section>
      ) : (
        <>
          <section aria-label={t(`orderPanel.${sub}`)} className="space-y-3">
            {shownLines.length === 0 ? (
              <p className="rounded-2xl bg-brand-greige px-4 py-8 text-center text-sm text-muted-foreground">
                {t(
                  sub === 'progress'
                    ? 'orderPanel.nothingInProgress'
                    : 'orderPanel.nothingDone',
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {shownLines.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-brand-greige px-4 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="tabular-nums text-muted-foreground">
                        {item.quantity}&times;
                      </span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    {item.kitchenStatus && (
                      <KitchenStatusBadge
                        status={item.kitchenStatus}
                        className="bg-white"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={onNewRound}
            >
              <Plus aria-hidden />
              {t('menuOrder.newRound')}
            </Button>
          </section>
          {bill}
        </>
      )}
    </div>
  )
}
