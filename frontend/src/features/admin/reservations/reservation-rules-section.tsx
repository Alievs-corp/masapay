import { type FormEvent, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  DepositType,
  ReservationRules,
} from '@/features/reservations/types'
import {
  useReservationRulesSettingsQuery,
  useUpdateReservationRulesSettingsMutation,
} from './location-rules-api'

type IntKey =
  | 'bookingWindowDays'
  | 'holdMinutes'
  | 'defaultDurationMinutes'
  | 'freeCancelHours'
  | 'lateCancelRefundPercent'
  | 'noShowRefundPercent'

type RulesDraft = Record<IntKey | 'depositValue', string> & {
  enabled: boolean
  depositType: DepositType
}

const LIMITS: Record<IntKey, [number, number]> = {
  bookingWindowDays: [0, 365],
  holdMinutes: [0, 600],
  defaultDurationMinutes: [15, 1440],
  freeCancelHours: [0, 720],
  lateCancelRefundPercent: [0, 100],
  noShowRefundPercent: [0, 100],
}

const INT_KEYS = Object.keys(LIMITS) as IntKey[]

function draftOf(rules: ReservationRules): RulesDraft {
  return {
    enabled: rules.enabled,
    depositType: rules.depositType,
    depositValue: String(rules.depositValue),
    bookingWindowDays: String(rules.bookingWindowDays),
    holdMinutes: String(rules.holdMinutes),
    defaultDurationMinutes: String(rules.defaultDurationMinutes),
    freeCancelHours: String(rules.freeCancelHours),
    lateCancelRefundPercent: String(rules.lateCancelRefundPercent),
    noShowRefundPercent: String(rules.noShowRefundPercent),
  }
}

function intIn(value: string, [min, max]: [number, number]): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const n = Number(value)
  return n >= min && n <= max ? n : null
}

/** Deposit value: 0 for NONE, at most two decimals, at most 100 for PERCENT. */
function depositIn(value: string, type: DepositType): number | null {
  if (type === 'NONE') return 0
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const n = Number(normalized)
  if (n <= 0) return null
  return type === 'PERCENT' && n > 100 ? null : n
}

/** The rules the draft describes, or null while a field is invalid. */
function parseRules(draft: RulesDraft): ReservationRules | null {
  const ints = {} as Record<IntKey, number>
  for (const key of INT_KEYS) {
    const n = intIn(draft[key], LIMITS[key])
    if (n === null) return null
    ints[key] = n
  }
  const depositValue = depositIn(draft.depositValue, draft.depositType)
  if (depositValue === null) return null
  return {
    enabled: draft.enabled,
    depositType: draft.depositType,
    depositValue,
    ...ints,
  }
}

/** Settings card for managers: how guests may book and what is refunded on cancel or no-show. */
export function ReservationRulesSection({
  restaurantId,
}: {
  restaurantId: string
}) {
  const { t } = useTranslation('adminReservations')
  const rules = useReservationRulesSettingsQuery(restaurantId)
  const [save, saveState] = useUpdateReservationRulesSettingsMutation()
  const [draft, setDraft] = useState<RulesDraft | null>(null)

  useEffect(() => {
    if (rules.data) setDraft(draftOf(rules.data))
  }, [rules.data])

  function set<K extends keyof RulesDraft>(key: K, value: RulesDraft[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : null))
    saveState.reset()
  }

  const parsed = draft ? parseRules(draft) : null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!parsed) return
    try {
      await save({ restaurantId, rules: parsed }).unwrap()
    } catch {
      // saveState.isError is shown below.
    }
  }

  const field = (key: IntKey | 'depositValue') => (
    <div className="space-y-1">
      <Label htmlFor={`resv-rule-${key}`}>{t(`rulesSection.${key}`)}</Label>
      <Input
        id={`resv-rule-${key}`}
        inputMode="decimal"
        value={draft?.[key] ?? ''}
        onChange={(event) => set(key, event.target.value)}
      />
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('rulesSection.title')}</CardTitle>
        <CardDescription>{t('rulesSection.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rules.isLoading && (
          <LoaderCircle
            className="size-6 animate-spin text-muted-foreground"
            aria-label={t('rulesSection.loading')}
          />
        )}
        {rules.isError && (
          <p className="text-sm text-destructive">
            {t('rulesSection.loadFailed')}
          </p>
        )}
        {draft && (
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="space-y-4"
            aria-label={t('rulesSection.title')}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('rulesSection.enabled')}</p>
              <ToggleGroup
                type="single"
                value={draft.enabled ? 'on' : 'off'}
                onValueChange={(value) =>
                  value && set('enabled', value === 'on')
                }
                className="justify-start"
                aria-label={t('rulesSection.enabled')}
              >
                <ToggleGroupItem value="on">
                  {t('rulesSection.on')}
                </ToggleGroupItem>
                <ToggleGroupItem value="off">
                  {t('rulesSection.off')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {field('bookingWindowDays')}
              {field('holdMinutes')}
              {field('defaultDurationMinutes')}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t('rulesSection.depositType')}
              </p>
              <ToggleGroup
                type="single"
                value={draft.depositType}
                onValueChange={(value) =>
                  value && set('depositType', value as DepositType)
                }
                className="grid gap-2 sm:grid-cols-3"
                aria-label={t('rulesSection.depositType')}
              >
                <ToggleGroupItem value="NONE">
                  {t('rulesSection.depositNone')}
                </ToggleGroupItem>
                <ToggleGroupItem value="FIXED">
                  {t('rulesSection.depositFixed')}
                </ToggleGroupItem>
                <ToggleGroupItem value="PERCENT">
                  {t('rulesSection.depositPercent')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {draft.depositType !== 'NONE' && (
              <div className="max-w-xs">{field('depositValue')}</div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {field('freeCancelHours')}
              {field('lateCancelRefundPercent')}
              {field('noShowRefundPercent')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('rulesSection.hint')}
            </p>
            {!parsed && (
              <p className="text-sm text-destructive">
                {t('rulesSection.invalid')}
              </p>
            )}
            {saveState.isError && (
              <p className="text-sm text-destructive">
                {t('rulesSection.saveFailed')}
              </p>
            )}
            {saveState.isSuccess && (
              <p className="text-sm text-muted-foreground" role="status">
                {t('rulesSection.saved')}
              </p>
            )}
            <Button type="submit" disabled={!parsed || saveState.isLoading}>
              {saveState.isLoading
                ? t('rulesSection.saving')
                : t('rulesSection.save')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
