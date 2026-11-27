import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/app/hooks'
import {
  useIntegrationSettingsQuery,
  useMyRestaurantsQuery,
} from '@/features/admin/settings/settings-api'
import { SettingsForm } from '@/features/admin/settings/settings-form'
import { ReservationRulesSection } from '@/features/admin/reservations/reservation-rules-section'
import { ChangePasswordForm } from '@/features/auth/change-password-form'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// Settings: every signed-in user changes their own password here. Managers
// and super admins also get the restaurant's service charge, POS provider and
// Payriff keys (#46): a manager sees their own restaurant, a super admin picks one.
export function SettingsPage() {
  const { t } = useTranslation('settings')
  const role = useAppSelector((state) => state.auth.user?.role)
  const runsRestaurants = role === 'SUPER_ADMIN' || role === 'RESTO_MANAGER'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('page.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {runsRestaurants ? t('page.description') : t('page.staffDescription')}
        </p>
      </header>

      {runsRestaurants && <RestaurantSettings />}
      <ChangePasswordForm />
    </div>
  )
}

function RestaurantSettings() {
  const { t } = useTranslation('settings')
  const restaurants = useMyRestaurantsQuery()
  const [chosen, setChosen] = useState<string | null>(null)
  const restaurantId = chosen ?? restaurants.data?.[0]?.id ?? null

  const settings = useIntegrationSettingsQuery(restaurantId ?? '', {
    skip: !restaurantId,
  })

  return (
    <>
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

      {restaurants.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('page.noRestaurant')}
        </p>
      )}

      {(restaurants.isLoading || settings.isFetching) && !settings.data && (
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-label={t('page.loading')}
        />
      )}
      {(restaurants.isError || settings.isError) && (
        <p className="text-sm text-destructive">{t('page.loadFailed')}</p>
      )}
      {settings.data && <SettingsForm settings={settings.data} />}
      {restaurantId && <ReservationRulesSection restaurantId={restaurantId} />}
    </>
  )
}
