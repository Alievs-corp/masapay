import { api } from '@/app/api'
import type { RootState } from '@/app/store'
import { subscribeToTopic } from '@/lib/stomp'
import type {
  CancelReservationRequest,
  CreateReservationRequest,
  FloorAvailability,
  ReservationView,
} from '@/features/reservations/types'

// Staff reservation endpoints (docs/RESERVATIONS-SPEC.md section 5). The day list stays
// live over the restaurant's reservations topic; the page also polls as a fallback.

export interface DayArgs {
  restaurantId: string
  date: string
}

export interface FloorArgs extends DayArgs {
  time: string
}

export interface ReservationActionArgs {
  restaurantId: string
  id: string
}

const withTags = api.enhanceEndpoints({
  addTagTypes: ['AdminReservations', 'AdminReservationFloor'],
})

export const reservationsAdminApi = withTags.injectEndpoints({
  endpoints: (build) => ({
    dayReservations: build.query<ReservationView[], DayArgs>({
      query: ({ restaurantId, date }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations`,
        params: { date },
      }),
      providesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservations', id: restaurantId },
      ],
      async onCacheEntryAdded(
        { restaurantId },
        { cacheDataLoaded, cacheEntryRemoved, dispatch, getState },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const refetch = () =>
          dispatch(
            reservationsAdminApi.util.invalidateTags([
              { type: 'AdminReservations', id: restaurantId },
              { type: 'AdminReservationFloor', id: restaurantId },
            ]),
          )
        let connectedBefore = false
        const subscription = subscribeToTopic(
          `/topic/restaurants/${restaurantId}/reservations`,
          () => refetch(),
          () => {
            if (connectedBefore) refetch()
            connectedBefore = true
          },
          () => (getState() as RootState).auth.accessToken,
        )
        await cacheEntryRemoved
        subscription.close()
      },
    }),
    reservationFloor: build.query<FloorAvailability, FloorArgs>({
      query: ({ restaurantId, date, time }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations/floor`,
        params: { date, time },
      }),
      providesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservationFloor', id: restaurantId },
      ],
    }),
    createStaffReservation: build.mutation<
      ReservationView,
      { restaurantId: string; body: CreateReservationRequest }
    >({
      query: ({ restaurantId, body }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservations', id: restaurantId },
        { type: 'AdminReservationFloor', id: restaurantId },
      ],
    }),
    seatReservation: build.mutation<ReservationView, ReservationActionArgs>({
      query: ({ restaurantId, id }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations/${id}/seat`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservations', id: restaurantId },
        { type: 'AdminReservationFloor', id: restaurantId },
      ],
    }),
    completeReservation: build.mutation<ReservationView, ReservationActionArgs>(
      {
        query: ({ restaurantId, id }) => ({
          url: `/admin/restaurants/${restaurantId}/reservations/${id}/complete`,
          method: 'POST',
        }),
        invalidatesTags: (_r, _e, { restaurantId }) => [
          { type: 'AdminReservations', id: restaurantId },
          { type: 'AdminReservationFloor', id: restaurantId },
        ],
      },
    ),
    cancelReservation: build.mutation<
      ReservationView,
      ReservationActionArgs & { body: CancelReservationRequest }
    >({
      query: ({ restaurantId, id, body }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations/${id}/cancel`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservations', id: restaurantId },
        { type: 'AdminReservationFloor', id: restaurantId },
      ],
    }),
    noShowReservation: build.mutation<ReservationView, ReservationActionArgs>({
      query: ({ restaurantId, id }) => ({
        url: `/admin/restaurants/${restaurantId}/reservations/${id}/no-show`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'AdminReservations', id: restaurantId },
        { type: 'AdminReservationFloor', id: restaurantId },
      ],
    }),
  }),
})

export const {
  useDayReservationsQuery,
  useReservationFloorQuery,
  useCreateStaffReservationMutation,
  useSeatReservationMutation,
  useCompleteReservationMutation,
  useCancelReservationMutation,
  useNoShowReservationMutation,
} = reservationsAdminApi
