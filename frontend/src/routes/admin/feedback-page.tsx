import { useState } from 'react'
import { LoaderCircle, MessageSquareText, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMyRestaurantsQuery } from '@/features/admin/settings/settings-api'
import { useServiceFeedbackQuery } from '@/features/admin/feedback/feedback-api'
import { toIsoDate } from '@/features/admin/tips/date-range'
import {
  formatAmount,
  formatDateTime,
} from '@/features/admin/transactions/format'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FEEDBACK_NOTE_OPTIONAL_FROM } from '@/features/reservations/types'
import { cn } from '@/lib/utils'

/** The last 30 days up to today, as local calendar days. */
function defaultRange(today: Date = new Date()) {
  const from = new Date(today)
  from.setDate(today.getDate() - 29)
  return { from: toIsoDate(from), to: toIsoDate(today) }
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1)

// Service feedback (docs/RESERVATIONS-SPEC.md): the score out of 10 guests give
// after paying, for managers and super admins, filtered by day and score.
export function FeedbackPage() {
  const { t } = useTranslation('adminFeedback')
  const restaurants = useMyRestaurantsQuery()
  const [chosen, setChosen] = useState<string | null>(null)
  const restaurantId = chosen ?? restaurants.data?.[0]?.id ?? null

  const [range, setRange] = useState(defaultRange)
  const [minScore, setMinScore] = useState(1)
  const [maxScore, setMaxScore] = useState(10)
  const rangeValid =
    range.from !== '' && range.to !== '' && range.from <= range.to

  const feedback = useServiceFeedbackQuery(
    {
      restaurantId: restaurantId ?? '',
      from: range.from,
      to: range.to,
      minScore,
      maxScore,
    },
    { skip: !restaurantId || !rangeValid },
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquareText aria-hidden className="size-6" />
          {t('page.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('page.subtitle')}</p>
      </header>

      {restaurants.data && restaurants.data.length > 1 && (
        <ToggleGroup
          type="single"
          value={restaurantId ?? undefined}
          onValueChange={(value) => value && setChosen(value)}
          className="flex-wrap justify-start"
        >
          {restaurants.data.map((restaurant) => (
            <ToggleGroupItem key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="feedback-from">{t('filters.from')}</Label>
          <Input
            id="feedback-from"
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange((r) => ({ ...r, from: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="feedback-to">{t('filters.to')}</Label>
          <Input
            id="feedback-to"
            type="date"
            value={range.to}
            onChange={(event) =>
              setRange((r) => ({ ...r, to: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="feedback-min">{t('filters.minScore')}</Label>
          <select
            id="feedback-min"
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={minScore}
            onChange={(event) => {
              const value = Number(event.target.value)
              setMinScore(value)
              if (value > maxScore) setMaxScore(value)
            }}
          >
            {SCORES.map((score) => (
              <option key={score} value={score}>
                {t('score', { score })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="feedback-max">{t('filters.maxScore')}</Label>
          <select
            id="feedback-max"
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={maxScore}
            onChange={(event) => {
              const value = Number(event.target.value)
              setMaxScore(value)
              if (value < minScore) setMinScore(value)
            }}
          >
            {SCORES.map((score) => (
              <option key={score} value={score}>
                {t('score', { score })}
              </option>
            ))}
          </select>
        </div>
        <ToggleGroup
          type="single"
          value={
            minScore === 1 && maxScore === 10
              ? 'all'
              : minScore === 1 && maxScore === FEEDBACK_NOTE_OPTIONAL_FROM - 1
                ? 'low'
                : minScore === FEEDBACK_NOTE_OPTIONAL_FROM && maxScore === 10
                  ? 'high'
                  : ''
          }
          onValueChange={(value) => {
            if (value === 'all') {
              setMinScore(1)
              setMaxScore(10)
            } else if (value === 'low') {
              setMinScore(1)
              setMaxScore(FEEDBACK_NOTE_OPTIONAL_FROM - 1)
            } else if (value === 'high') {
              setMinScore(FEEDBACK_NOTE_OPTIONAL_FROM)
              setMaxScore(10)
            }
          }}
          aria-label={t('filters.quick')}
        >
          <ToggleGroupItem value="all">{t('filters.all')}</ToggleGroupItem>
          <ToggleGroupItem value="low">{t('filters.low')}</ToggleGroupItem>
          <ToggleGroupItem value="high">{t('filters.high')}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {!rangeValid && (
        <p className="text-sm text-destructive">{t('filters.invalidRange')}</p>
      )}

      {restaurants.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('page.noRestaurant')}
        </p>
      )}
      {(restaurants.isLoading || feedback.isLoading) && (
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-label={t('page.loading')}
        />
      )}
      {(restaurants.isError || feedback.isError) && (
        <p className="text-sm text-destructive">{t('page.loadFailed')}</p>
      )}

      {feedback.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Star aria-hidden className="size-6" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('summary.average')}
                  </p>
                  <p
                    className="text-2xl font-semibold"
                    data-testid="feedback-average"
                  >
                    {feedback.data.averageScore === null
                      ? t('summary.noAverage')
                      : t('score', {
                          score: feedback.data.averageScore.toFixed(1),
                        })}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  {t('summary.count')}
                </p>
                <p className="text-2xl font-semibold">{feedback.data.count}</p>
              </CardContent>
            </Card>
          </div>

          {feedback.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('page.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.score')}</TableHead>
                    <TableHead>{t('columns.note')}</TableHead>
                    <TableHead>{t('columns.table')}</TableHead>
                    <TableHead>{t('columns.time')}</TableHead>
                    <TableHead className="text-right">
                      {t('columns.amount')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.data.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-sm font-semibold',
                            entry.score >= FEEDBACK_NOTE_OPTIONAL_FROM
                              ? 'bg-[#08CB00] text-black'
                              : 'bg-black text-white',
                          )}
                        >
                          {t('score', { score: entry.score })}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-sm whitespace-normal">
                        {entry.note ?? (
                          <span className="text-muted-foreground">
                            {t('columns.noNote')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.tableLabel ?? '-'}
                        {entry.kind === 'RESERVATION' && (
                          <span className="block text-xs text-muted-foreground">
                            {t('columns.reservation', {
                              code: entry.reservationCode ?? '',
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {formatAmount(entry.amountPaid, entry.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
