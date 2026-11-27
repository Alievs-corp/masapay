import { Minus, Plus, UtensilsCrossed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/features/order/format'
import { cn } from '@/lib/utils'
import type { CustomerDish } from './customer-menu-api'
import { MAX_QUANTITY } from './use-basket'

// One dish on the customer's menu: a light grey card with its photo on the
// left, its name and price, and a black "Add" button that turns into - / +
// once added. Tapping the card opens a larger card with the photo and the
// ingredients, so a guest who does not know the dish can see what it is.

/** "toyuq, düyü, zəfəran" as separate items. */
function ingredientList(ingredients: string | null): string[] {
  return (ingredients ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

export function DishPicture({
  dish,
  className,
}: {
  dish: CustomerDish
  className: string
}) {
  if (dish.imageUrl) {
    return (
      <img
        src={dish.imageUrl}
        alt=""
        loading="lazy"
        className={cn('shrink-0 bg-white object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-white text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      <UtensilsCrossed className="size-1/3" />
    </div>
  )
}

/** Round black - / + buttons with the quantity between them. */
export function Stepper({
  quantity,
  onChange,
  decreaseLabel,
  increaseLabel,
  quantityLabel,
}: {
  quantity: number
  onChange: (delta: number) => void
  decreaseLabel: string
  increaseLabel: string
  quantityLabel: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        size="icon"
        className="size-9"
        onClick={() => onChange(-1)}
        aria-label={decreaseLabel}
      >
        <Minus aria-hidden />
      </Button>
      <span
        className="w-6 text-center text-sm tabular-nums"
        aria-label={quantityLabel}
      >
        {quantity}
      </span>
      <Button
        size="icon"
        className="size-9"
        onClick={() => onChange(1)}
        disabled={quantity >= MAX_QUANTITY}
        aria-label={increaseLabel}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  )
}

function QuantityControls({
  dish,
  quantity,
  onChange,
  size = 'sm',
}: {
  dish: CustomerDish
  quantity: number
  onChange: (delta: number) => void
  size?: 'sm' | 'lg'
}) {
  const { t } = useTranslation('customer')
  if (quantity === 0) {
    return (
      <Button
        size={size === 'lg' ? 'lg' : 'sm'}
        className={cn('shrink-0', size === 'lg' ? 'h-12 flex-1' : 'h-9 px-4')}
        onClick={() => onChange(1)}
        aria-label={t('dish.addAria', { name: dish.name })}
      >
        {size === 'lg' && <Plus aria-hidden />}
        {t('dish.add')}
      </Button>
    )
  }
  return (
    <Stepper
      quantity={quantity}
      onChange={onChange}
      decreaseLabel={t('dish.decreaseAria', { name: dish.name })}
      increaseLabel={t('dish.increaseAria', { name: dish.name })}
      quantityLabel={t('dish.quantityAria', { name: dish.name })}
    />
  )
}

function ComboLine({ dish }: { dish: CustomerDish }) {
  if (dish.components.length === 0) return null
  return (
    <span className="block text-xs text-muted-foreground">
      {dish.components.map((c) => `${c.quantity} x ${c.name}`).join(', ')}
    </span>
  )
}

export function DishRow({
  dish,
  currency,
  quantity,
  onChange,
  onOpen,
}: {
  dish: CustomerDish
  currency: string
  quantity: number
  onChange: (delta: number) => void
  onOpen: () => void
}) {
  const { t } = useTranslation('customer')
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-brand-greige p-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('dish.aboutAria', { name: dish.name })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DishPicture dish={dish} className="size-20 rounded-xl" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {dish.name}
            {dish.components.length > 0 && (
              <Badge variant="secondary" className="bg-white">
                {t('dish.combo')}
              </Badge>
            )}
          </span>
          <ComboLine dish={dish} />
          {dish.ingredients && (
            <span className="line-clamp-1 block text-xs text-muted-foreground">
              {dish.ingredients}
            </span>
          )}
          {dish.description && (
            <span className="line-clamp-1 block text-xs text-muted-foreground">
              {dish.description}
            </span>
          )}
          <span className="block text-base tabular-nums">
            {formatCurrency(dish.price, currency)}
          </span>
        </span>
      </button>
      <QuantityControls dish={dish} quantity={quantity} onChange={onChange} />
    </li>
  )
}

export function DishDetail({
  dish,
  currency,
  quantity,
  onChange,
  onClose,
}: {
  dish: CustomerDish | null
  currency: string
  quantity: number
  onChange: (delta: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation('customer')
  const ingredients = dish ? ingredientList(dish.ingredients) : []
  return (
    <Dialog open={dish !== null} onOpenChange={(next) => !next && onClose()}>
      {/* The photo goes edge to edge below a top strip of its own for the close button, so the X never sits on the picture. */}
      <DialogContent className="max-h-[92svh] max-w-[430px] gap-0 overflow-y-auto rounded-2xl p-0 pt-12 sm:p-0 sm:pt-12">
        {dish && (
          <>
            <DishPicture
              dish={dish}
              className="aspect-[4/3] w-full bg-brand-greige"
            />
            <div className="space-y-4 p-4 sm:p-6">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                  {dish.name}
                  {dish.components.length > 0 && (
                    <Badge variant="secondary">{t('dish.combo')}</Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-base font-medium tabular-nums text-foreground">
                  {formatCurrency(dish.price, currency)}
                </DialogDescription>
              </DialogHeader>
              <ComboLine dish={dish} />
              {ingredients.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    {t('dish.ingredients')}
                  </h4>
                  <ul className="flex flex-wrap gap-1.5">
                    {ingredients.map((item, index) => (
                      <li key={`${index}-${item}`}>
                        <Badge
                          variant="secondary"
                          className="bg-brand-greige font-normal"
                        >
                          {item}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {dish.description && (
                <p className="text-sm text-muted-foreground">
                  {dish.description}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <QuantityControls
                  dish={dish}
                  quantity={quantity}
                  onChange={onChange}
                  size="lg"
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
