import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OrderItem } from '@/features/order/types'
import { isRestaurantClosed } from '@/lib/api-errors'
import { ConfirmOrderDialog } from './confirm-order-dialog'
import { type CustomerScreen, CustomerBars } from './customer-bars'
import {
  type CustomerDish,
  useCustomerMenuQuery,
  usePlaceOrderMutation,
} from './customer-menu-api'
import { MenuBrowser } from './menu-browser'
import { type OrderSubTab, OrderPanel } from './order-panel'
import { extrasToAsk, upsellFor } from './upsell'
import { UpsellDialog } from './upsell-dialog'
import { useBasket } from './use-basket'

// The customer's table screen (#140): a Menu tab with today's menu and an
// Order tab with the basket, the dishes in the kitchen and the bill. A black
// bar at the bottom confirms the basket from either tab; a confirmed round
// goes onto the bill and cannot be removed from here. Before "Əminsiniz?" the
// restaurant's suggested extras are offered (#141). "Əlavə sifariş" goes back
// to the menu, so another round can be ordered at any time.
export function MenuOrderCard({
  qrToken,
  currency,
  restaurantName,
  tableLabel,
  items = [],
  bill,
}: {
  qrToken: string
  currency: string
  restaurantName?: string
  tableLabel?: string
  /** Lines of the table's open bill, shown by kitchen progress. */
  items?: OrderItem[]
  /** The bill and its payment, shown on the Order tab. */
  bill?: ReactNode
}) {
  const { t } = useTranslation('customer')
  const menu = useCustomerMenuQuery(qrToken)
  const basket = useBasket(qrToken)
  const { syncWithMenu } = basket
  const [screen, setScreen] = useState<CustomerScreen>('menu')
  const [sub, setSub] = useState<OrderSubTab>('cart')
  const [confirming, setConfirming] = useState(false)
  const [upsell, setUpsell] = useState<{
    suggestions: CustomerDish[]
    extras: CustomerDish[]
  } | null>(null)
  const [addedExtras, setAddedExtras] = useState<Set<string>>(new Set())
  const [justOrdered, setJustOrdered] = useState(false)
  const [placeOrder, placeState] = usePlaceOrderMutation()

  // Whenever today's menu (re)loads, drop basket dishes that left it.
  useEffect(() => {
    if (menu.data) syncWithMenu(menu.data.flatMap((c) => c.items))
  }, [menu.data, syncWithMenu])

  function showScreen(next: CustomerScreen) {
    if (next === 'order' && screen !== 'order') {
      setSub(basket.count > 0 ? 'cart' : 'progress')
    }
    setScreen(next)
  }

  function startNewRound() {
    setJustOrdered(false)
    showScreen('menu')
  }

  // Suggestions (#141) and the extras every customer is asked about, such as
  // ketchup or water (#185), are worked out when the customer asks to confirm
  // and shown together in one dialog first; with nothing to offer or ask,
  // "Əminsiniz?" opens straight away.
  function askToConfirm() {
    const today = (menu.data ?? []).flatMap((c) => c.items)
    const suggestions = upsellFor(basket.entries, today)
    const suggested = new Set(suggestions.map((dish) => dish.id))
    const extras = extrasToAsk(basket.entries, today).filter(
      (dish) => !suggested.has(dish.id),
    )
    if (suggestions.length === 0 && extras.length === 0) {
      setConfirming(true)
      return
    }
    setAddedExtras(new Set())
    setUpsell({ suggestions, extras })
  }

  function addExtra(dish: CustomerDish) {
    basket.change(dish, 1)
    setAddedExtras((current) => new Set(current).add(dish.id))
  }

  function continueToConfirm() {
    setUpsell(null)
    setConfirming(true)
  }

  async function onConfirm() {
    try {
      await placeOrder({
        qrToken,
        items: basket.entries.map(({ dish, quantity }) => ({
          menuItemId: dish.id,
          quantity,
        })),
      }).unwrap()
      basket.clear()
      placeState.reset()
      setConfirming(false)
      setJustOrdered(true)
      setScreen('order')
      setSub('progress')
    } catch {
      // placeState.error is shown in the dialog.
    }
  }

  const conflict =
    placeState.error &&
    'status' in placeState.error &&
    placeState.error.status === 409
  const orderError = !placeState.isError
    ? null
    : isRestaurantClosed(placeState.error)
      ? t('menuOrder.restaurantClosed')
      : conflict
        ? t('menuOrder.conflict')
        : t('menuOrder.failed')

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl leading-tight tracking-tight">
            {screen === 'menu'
              ? restaurantName
                ? t('tableScreen.welcomeTo', { name: restaurantName })
                : t('tableScreen.welcome')
              : t('tableScreen.orderStatus')}
          </h1>
          {screen === 'menu' && (
            <p className="text-sm text-muted-foreground">
              {t('tableScreen.takeOrder')}
            </p>
          )}
        </div>
        {tableLabel && (
          <div className="shrink-0 rounded-xl bg-brand-greige px-3 py-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              {t('tableScreen.table')}
            </p>
            <p className="max-w-28 truncate text-base">{tableLabel}</p>
          </div>
        )}
      </header>

      {screen === 'menu' ? (
        <MenuBrowser
          categories={menu.data ?? []}
          loading={menu.isLoading}
          failed={menu.isError}
          currency={currency}
          quantityOf={basket.quantityOf}
          onChange={(dish, delta) => basket.change(dish, delta)}
        />
      ) : (
        <OrderPanel
          sub={sub}
          onSub={setSub}
          entries={basket.entries}
          count={basket.count}
          currency={currency}
          items={items}
          justOrdered={justOrdered}
          onChange={(dish, delta) => basket.change(dish, delta)}
          onNewRound={startNewRound}
          bill={bill}
        />
      )}

      <CustomerBars
        screen={screen}
        onScreen={showScreen}
        count={basket.count}
        total={basket.total}
        currency={currency}
        onCheckout={askToConfirm}
      />

      <UpsellDialog
        open={upsell !== null}
        extras={upsell?.suggestions ?? []}
        asked={upsell?.extras ?? []}
        quantityOf={(id) =>
          basket.entries.find((entry) => entry.dish.id === id)?.quantity ?? 0
        }
        onChangeAsked={(dish, delta) => basket.change(dish, delta)}
        added={addedExtras}
        currency={currency}
        onAdd={addExtra}
        onContinue={continueToConfirm}
        onClose={() => setUpsell(null)}
      />

      <ConfirmOrderDialog
        open={confirming}
        entries={basket.entries}
        total={basket.total}
        currency={currency}
        busy={placeState.isLoading}
        error={orderError}
        onConfirm={() => void onConfirm()}
        onClose={() => {
          placeState.reset()
          setConfirming(false)
        }}
      />
    </div>
  )
}
