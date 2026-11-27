import { api } from '@/app/api'
import type { AdminTable } from '@/features/admin/tables/tables-api'
import type {
  ReservationRules,
  TableLocation,
} from '@/features/reservations/types'

// A table's place in the restaurant (kind, floor, zone, 2D box) and the
// restaurant's reservation rules, both edited by managers (docs/RESERVATIONS-SPEC.md).

export const locationRulesApi = api.injectEndpoints({
  endpoints: (build) => ({
    updateTableLocationSettings: build.mutation<
      AdminTable,
      { restaurantId: string; tableId: string; location: TableLocation }
    >({
      query: ({ restaurantId, tableId, location }) => ({
        url: `/admin/restaurants/${restaurantId}/tables/${tableId}/location`,
        method: 'PUT',
        body: location,
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'Tables', id: restaurantId },
        'Floor',
      ],
    }),
    reservationRulesSettings: build.query<ReservationRules, string>({
      query: (restaurantId) =>
        `/admin/restaurants/${restaurantId}/reservation-rules`,
      providesTags: (_r, _e, restaurantId) => [
        { type: 'Settings', id: `reservation-rules-${restaurantId}` },
      ],
    }),
    updateReservationRulesSettings: build.mutation<
      ReservationRules,
      { restaurantId: string; rules: ReservationRules }
    >({
      query: ({ restaurantId, rules }) => ({
        url: `/admin/restaurants/${restaurantId}/reservation-rules`,
        method: 'PUT',
        body: rules,
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'Settings', id: `reservation-rules-${restaurantId}` },
      ],
    }),
  }),
})

export const {
  useUpdateTableLocationSettingsMutation,
  useReservationRulesSettingsQuery,
  useUpdateReservationRulesSettingsMutation,
} = locationRulesApi
