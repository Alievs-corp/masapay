import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Minus,
  Plus,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/features/order/format'
import type { CustomerDish } from '@/features/ordering/customer-menu-api'
import { cn } from '@/lib/utils'
import { matchAllergens, menuHasIngredientData } from './allergen-match'
import { useGuestRestaurantMenuQuery } from './reservations-api'
import type { Allergen } from './types'

// Pre-order step: category chips, light cards with the photo on the left,
// name + price, a black Add button that turns into -/+ steppers, and a black
// bottom bar "N items - Order". Prices are minor units. Dishes that mention an
// allergen the guest picked in the notes step get a warning (spec 11.2).

export type Preorder = Record<string, { dish: CustomerDish; quantity: number }>

const MAX_QTY = 99

export function StepMenu({
  restaurantId,
  date,
  currency,
  preorder,
  onChange,
  onDone,
  onSkip,
  allergens = [],
  saving,
  error,
}: {
  restaurantId: string
  /** Booking day, so the menu lists the dishes available then. */
  date?: string
  currency: string
  preorder: Preorder
  onChange: (next: Preorder) => void
  onDone: () => void
  onSkip: () => void
  /** Allergens from the notes step. */
  allergens?: Allergen[]
  saving: boolean
  error: string | null
}) {
  const { t } = useTranslation('reservations')
  const menu = useGuestRestaurantMenuQuery({ restaurantId, date })
  const categories = useMemo(
    () => (menu.data ?? []).filter((c) => c.items.length > 0),
    [menu.data],
  )
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const active = categories.find((c) => c.id === categoryId) ?? categories[0]
  const hasIngredients = useMemo(
    () => menuHasIngredientData(categories),
    [categories],
  )
  const allergyList = allergens.map((a) => t(`notes.allergens.${a}`)).join(', ')
  const nameOf = (a: Allergen) => t(`notes.allergens.${a}`)

  const entries = Object.values(preorder)
  const count = entries.reduce((sum, e) => sum + e.quantity, 0)
  const total = entries.reduce((sum, e) => sum + e.dish.price * e.quantity, 0)

  const change = (dish: CustomerDish, delta: number) => {
    const quantity = Math.min(
      MAX_QTY,
      (preorder[dish.id]?.quantity ?? 0) + delta,
    )
    const next = { ...preorder }
    if (quantity <= 0) delete next[dish.id]
    else next[dish.id] = { dish, quantity }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('reserve.menuTitle')}</h2>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {t('reserve.skipMenu')}
        </Button>
      </div>

      {menu.isLoading && (
        <p className="text-sm text-muted-foreground">{t('reserve.loading')}</p>
      )}
      {menu.isError && (
        <p className="text-sm text-destructive">{t('reserve.menuError')}</p>
      )}

      {allergens.length > 0 && menu.data && (
        <div
          role="note"
          className="flex gap-2 rounded-2xl border border-destructive/60 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {hasIngredients
              ? `${t('allergy.told', { list: allergyList })} ${t('allergy.checkMarked')}`
              : t('allergy.noData', { list: allergyList })}
          </p>
        </div>
      )}

      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === active?.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-1.5 text-sm',
                c.id === active?.id
                  ? 'border-black bg-black text-white'
                  : 'border-border bg-white',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {active?.items.map((dish) => {
          const quantity = preorder[dish.id]?.quantity ?? 0
          const flagged = matchAllergens(dish, allergens)
          return (
            <li
              key={dish.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl bg-[#F6F5F6] p-3',
                flagged.length > 0 && 'ring-1 ring-destructive/60',
              )}
            >
              {dish.imageUrl ? (
                <img
                  src={dish.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-20 shrink-0 rounded-xl bg-white object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-white text-muted-foreground"
                >
                  <UtensilsCrossed className="size-6" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate font-semibold">{dish.name}</p>
                <p className="text-sm">
                  {formatCurrency(dish.price, currency)}
                </p>
                {flagged.length > 0 && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-destructive">
                    <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                    {t('allergy.mayContain', {
                      list: flagged.map(nameOf).join(', '),
                    })}
                  </p>
                )}
              </div>
              {quantity === 0 ? (
                <Button
                  size="sm"
                  onClick={() => change(dish, 1)}
                  aria-label={t('reserve.addAria', { name: dish.name })}
                >
                  {t('reserve.add')}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8"
                    aria-label={t('reserve.removeAria', { name: dish.name })}
                    onClick={() => change(dish, -1)}
                  >
                    <Minus aria-hidden />
                  </Button>
                  <span className="w-5 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    className="size-8"
                    aria-label={t('reserve.addAria', { name: dish.name })}
                    onClick={() => change(dish, 1)}
                  >
                    <Plus aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto w-full max-w-3xl px-4">
        <button
          type="button"
          disabled={count === 0 || saving}
          onClick={onDone}
          className="flex h-14 w-full items-center justify-between rounded-full bg-black px-6 text-white disabled:opacity-50"
        >
          <span className="text-sm">
            {t('reserve.itemsCount', { count })} -{' '}
            {formatCurrency(total, currency)}
          </span>
          <span className="flex items-center gap-2 font-semibold">
            {t('reserve.order')}
            <ArrowRight aria-hidden className="size-4" />
          </span>
        </button>
      </div>
    </div>
  )
}
