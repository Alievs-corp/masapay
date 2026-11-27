import { Accessibility, Baby, Minus, Plus, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ALLERGENS,
  MAX_ALLERGY_NOTE,
  MAX_CHILD_SEATS,
  MAX_GUEST_NOTE,
  OCCASIONS,
  type Allergen,
  type GuestRequests,
  type Occasion,
} from './types'
import type { GuestNotesValue } from './guest-requests'

// The guest's special requests (spec 11.1), fully digital: child seats, wheelchair
// access, occasion, allergies from a fixed list + a free allergy note, and a
// general note. Used by the reserve flow's notes step and by the editor on
// /reservation/:code. Controlled; the parent sends it to the server.

function Chip({
  pressed,
  onClick,
  children,
  className,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm',
        pressed
          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
          : 'border-border bg-white dark:bg-black',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function GuestRequestsForm({
  value,
  onChange,
  idPrefix = 'guest',
}: {
  value: GuestNotesValue
  onChange: (next: GuestNotesValue) => void
  idPrefix?: string
}) {
  const { t } = useTranslation('reservations')
  const r = value.requests
  const setRequests = (patch: Partial<GuestRequests>) =>
    onChange({ ...value, requests: { ...r, ...patch } })

  const toggleAllergen = (allergen: Allergen) =>
    setRequests({
      allergens: r.allergens.includes(allergen)
        ? r.allergens.filter((a) => a !== allergen)
        : [...r.allergens, allergen],
    })

  const setOccasion = (occasion: Occasion | null) => setRequests({ occasion })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F6F5F6] p-3 dark:bg-[#0A0A0A]">
          <span className="flex items-center gap-2 text-sm">
            <Baby aria-hidden className="size-5 shrink-0" />
            <span>
              <span
                className="block font-medium"
                id={`${idPrefix}-child-label`}
              >
                {t('notes.childSeats')}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t('notes.childSeatsHint')}
              </span>
            </span>
          </span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-labelledby={`${idPrefix}-child-label`}
          >
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label={t('notes.fewerChildSeats')}
              disabled={r.childSeats <= 0}
              onClick={() => setRequests({ childSeats: r.childSeats - 1 })}
            >
              <Minus aria-hidden />
            </Button>
            <span
              className="w-6 text-center text-sm font-semibold tabular-nums"
              data-testid={`${idPrefix}-child-seats`}
            >
              {r.childSeats}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label={t('notes.moreChildSeats')}
              disabled={r.childSeats >= MAX_CHILD_SEATS}
              onClick={() => setRequests({ childSeats: r.childSeats + 1 })}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </div>
        <Chip
          pressed={r.wheelchair}
          onClick={() => setRequests({ wheelchair: !r.wheelchair })}
          className="justify-center rounded-2xl"
        >
          <Accessibility aria-hidden className="size-5" />
          {t('notes.wheelchair')}
        </Chip>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">
          {t('notes.occasion')}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Chip pressed={r.occasion === null} onClick={() => setOccasion(null)}>
            {t('notes.occasionNone')}
          </Chip>
          {OCCASIONS.map((occasion) => (
            <Chip
              key={occasion}
              pressed={r.occasion === occasion}
              onClick={() => setOccasion(occasion)}
            >
              {t(`notes.occasions.${occasion}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert aria-hidden className="size-4" />
          {t('notes.allergies')}
        </legend>
        <p className="text-xs text-muted-foreground">
          {t('notes.allergiesHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => (
            <Chip
              key={allergen}
              pressed={r.allergens.includes(allergen)}
              onClick={() => toggleAllergen(allergen)}
            >
              {t(`notes.allergens.${allergen}`)}
            </Chip>
          ))}
        </div>
        {r.allergens.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-allergy-note`}>
              {t('notes.allergyNote')}
            </Label>
            <Textarea
              id={`${idPrefix}-allergy-note`}
              rows={2}
              maxLength={MAX_ALLERGY_NOTE}
              placeholder={t('notes.allergyNotePlaceholder')}
              value={r.allergyNote ?? ''}
              onChange={(event) =>
                setRequests({ allergyNote: event.target.value })
              }
            />
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-note`}>{t('notes.note')}</Label>
        <Textarea
          id={`${idPrefix}-note`}
          rows={3}
          maxLength={MAX_GUEST_NOTE}
          placeholder={t('notes.notePlaceholder')}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
        <p className="text-right text-xs text-muted-foreground">
          {t('notes.charsLeft', {
            count: MAX_GUEST_NOTE - value.note.length,
          })}
        </p>
      </div>
    </div>
  )
}
