import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CustomerCategory, CustomerDish } from './customer-menu-api'
import { DishDetail, DishRow } from './dish-card'

// The customer's menu (#180), shown right on the table screen: a search
// field, the categories as a row of chips (the chosen one black), and the
// chosen category's dishes as cards. Searching looks through every category.
// Tapping a dish opens its card with a large photo and its ingredients.
export function MenuBrowser({
  categories,
  loading,
  failed,
  currency,
  quantityOf,
  onChange,
}: {
  categories: CustomerCategory[]
  loading: boolean
  failed: boolean
  currency: string
  quantityOf: (dishId: string) => number
  onChange: (dish: CustomerDish, delta: number) => void
}) {
  const { t } = useTranslation('customer')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const allDishes = categories.flatMap((category) => category.items)
  const detail = allDishes.find((dish) => dish.id === detailId) ?? null
  const active =
    categories.find((category) => category.id === chosenId) ?? categories[0]

  const needle = query.trim().toLocaleLowerCase()
  const searching = needle !== ''
  const found = searching
    ? allDishes.filter((dish) =>
        [dish.name, dish.ingredients ?? '', dish.description ?? '']
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle),
      )
    : []
  const shown = searching ? found : (active?.items ?? [])
  const sectionTitle = searching ? t('menuBrowser.results') : active?.name

  return (
    <div className="flex flex-col gap-5">
      <label className="relative block">
        <span className="sr-only">{t('menuBrowser.search')}</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('menuBrowser.searchPlaceholder')}
          className="h-11 rounded-xl border-0 bg-brand-greige pl-11"
        />
      </label>

      {loading && (
        <LoaderCircle
          className="mx-auto my-10 size-6 animate-spin text-muted-foreground"
          aria-label={t('menuBrowser.loading')}
        />
      )}
      {failed && (
        <p className="text-sm text-destructive">{t('menuBrowser.failed')}</p>
      )}
      {!loading && !failed && categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('menuBrowser.empty')}
        </p>
      )}

      {active && (
        <>
          {!searching && (
            <nav
              aria-label={t('menuBrowser.categories')}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
            >
              {categories.map((category) => {
                const selected = category.id === active.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChosenId(category.id)}
                    className={cn(
                      'h-10 shrink-0 rounded-xl px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'bg-brand-near-black text-white'
                        : 'bg-brand-greige text-foreground/70 hover:text-foreground',
                    )}
                  >
                    {category.name}
                  </button>
                )
              })}
            </nav>
          )}

          <section aria-label={sectionTitle} className="space-y-3">
            <h3 className="text-lg tracking-tight">{sectionTitle}</h3>
            {searching && found.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('menuBrowser.noResults')}
              </p>
            ) : (
              <ul className="space-y-3">
                {shown.map((dish) => (
                  <DishRow
                    key={dish.id}
                    dish={dish}
                    currency={currency}
                    quantity={quantityOf(dish.id)}
                    onChange={(delta) => onChange(dish, delta)}
                    onOpen={() => setDetailId(dish.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <DishDetail
        dish={detail}
        currency={currency}
        quantity={detail ? quantityOf(detail.id) : 0}
        onChange={(delta) => detail && onChange(detail, delta)}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
