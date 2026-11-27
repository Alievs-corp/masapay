import { api } from '@/app/api'
import {
  type CustomerCategory,
  type CustomerDish,
} from '@/features/ordering/customer-menu-api'
import { toMinor } from '@/features/order/order-api'
import type { Checkout } from '@/features/payment/payment-api'
import type {
  CancelReservationRequest,
  CreateReservationRequest,
  FeedbackSubmitRequest,
  FeedbackView,
  FloorAvailability,
  ReservationInfo,
  ReservationItemRequest,
  ReservationView,
  UpdateReservationNotesRequest,
} from './types'

// The one module for the public reservation endpoints (spec section 5): the
// reserve flow (/r/:restaurantSlug/reserve), the reservation page
// (/reservation/:code), the QR arrival modal on the table page and the service
// feedback step. One module means one cache and one set of tags, so paying,
// cancelling or checking in refetches every screen that shows the reservation.
// Endpoint names are prefixed with "guest" where a staff endpoint of the same
// api slice uses the plain name (staff-reservations-api.ts, admin menu-api.ts).
// Amounts stay in manat as the server sends them; screens convert with toMinor
// for formatCurrency.

interface MenuCategoryDto {
  id: string
  name: string
  items: {
    id: string
    name: string
    description: string | null
    ingredients?: string | null
    price: number
    components?: { name: string; quantity: number }[]
    suggestionIds?: string[]
    askBeforeConfirm?: boolean
    imageUrl?: string | null
  }[]
}

function toCategories(dto: MenuCategoryDto[]): CustomerCategory[] {
  return dto.map((category) => ({
    id: category.id,
    name: category.name,
    items: category.items.map((item): CustomerDish => ({
      id: item.id,
      name: item.name,
      description: item.description,
      ingredients: item.ingredients ?? null,
      price: toMinor(item.price),
      components: item.components ?? [],
      suggestionIds: item.suggestionIds ?? [],
      askBeforeConfirm: item.askBeforeConfirm ?? false,
      imageUrl: item.imageUrl ?? null,
    })),
  }))
}

const rest = (restaurantId: string) =>
  `/public/restaurants/${encodeURIComponent(restaurantId)}`
const byCode = (code: string) =>
  `/public/reservations/${encodeURIComponent(code)}`

const reservationsBase = api.enhanceEndpoints({
  addTagTypes: ['Reservation', 'ReservationFloor'],
})

export const reservationsApi = reservationsBase.injectEndpoints({
  endpoints: (build) => ({
    reservationInfo: build.query<ReservationInfo, string>({
      query: (restaurantId) => `${rest(restaurantId)}/reservations/info`,
    }),
    guestReservationFloor: build.query<
      FloorAvailability,
      { restaurantId: string; date: string; time: string; partySize: number }
    >({
      query: ({ restaurantId, date, time, partySize }) => ({
        url: `${rest(restaurantId)}/reservations/floor`,
        params: { date, time, partySize },
      }),
      providesTags: ['ReservationFloor'],
    }),
    /** Dishes available on the booking day (`date` YYYY-MM-DD, Baku; spec 11). */
    guestRestaurantMenu: build.query<
      CustomerCategory[],
      { restaurantId: string; date?: string }
    >({
      query: ({ restaurantId, date }) => ({
        url: `${rest(restaurantId)}/menu`,
        params: date ? { date } : undefined,
      }),
      transformResponse: toCategories,
    }),
    createReservation: build.mutation<
      ReservationView,
      { restaurantId: string; body: CreateReservationRequest }
    >({
      query: ({ restaurantId, body }) => ({
        url: `${rest(restaurantId)}/reservations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ReservationFloor'],
    }),
    updateReservationItems: build.mutation<
      ReservationView,
      { code: string; items: ReservationItemRequest[] }
    >({
      query: ({ code, items }) => ({
        url: `${byCode(code)}/items`,
        method: 'PUT',
        body: { items },
      }),
      invalidatesTags: (_r, _e, { code }) => [
        { type: 'Reservation', id: code },
      ],
    }),
    /** Guest requests + note, editable until the start time (spec 11.1). */
    updateReservationNotes: build.mutation<
      ReservationView,
      { code: string } & UpdateReservationNotesRequest
    >({
      query: ({ code, note, requests }) => ({
        url: `${byCode(code)}/notes`,
        method: 'PUT',
        body: { note, requests },
      }),
      invalidatesTags: (_r, _e, { code }) => [
        { type: 'Reservation', id: code },
      ],
    }),
    checkoutReservation: build.mutation<
      Checkout,
      { code: string; payFull?: boolean }
    >({
      query: ({ code, payFull }) => ({
        url: `${byCode(code)}/checkout`,
        method: 'POST',
        body: { payFull: payFull ?? false },
      }),
      // A payment that is abandoned leaves the reservation confirmed and unpaid;
      // refetch so the page never shows a stale payment state after returning.
      invalidatesTags: (_r, _e, { code }) => [
        { type: 'Reservation', id: code },
      ],
    }),
    reservation: build.query<ReservationView, string>({
      query: (code) => byCode(code),
      providesTags: (_r, _e, code) => [{ type: 'Reservation', id: code }],
    }),
    guestCancelReservation: build.mutation<
      ReservationView,
      { code: string } & CancelReservationRequest
    >({
      query: ({ code, reason }) => ({
        url: `${byCode(code)}/cancel`,
        method: 'POST',
        body: { reason: reason ?? null },
      }),
      invalidatesTags: (_r, _e, { code }) => [
        { type: 'Reservation', id: code },
        'ReservationFloor',
      ],
    }),
    tableReservation: build.query<
      ReservationView | null,
      { qrToken: string; code: string }
    >({
      query: ({ qrToken, code }) => ({
        url: `/public/tables/${encodeURIComponent(qrToken)}/reservation`,
        params: { code },
        // 204 when the code is not for this table or outside its window.
        responseHandler: async (response) => {
          const text = await response.text()
          return text ? (JSON.parse(text) as ReservationView) : null
        },
      }),
    }),
    checkInReservation: build.mutation<
      ReservationView,
      { qrToken: string; code: string }
    >({
      query: ({ qrToken, code }) => ({
        url: `/public/tables/${encodeURIComponent(qrToken)}/reservation/check-in`,
        method: 'POST',
        body: { code },
      }),
      invalidatesTags: (_r, _e, { code }) => [
        { type: 'Reservation', id: code },
        'TableOrder',
        'ReservationFloor',
      ],
    }),
    /** Service rating after a successful payment (table bill or reservation). */
    submitServiceFeedback: build.mutation<FeedbackView, FeedbackSubmitRequest>({
      query: (body) => ({ url: '/public/feedback', method: 'POST', body }),
    }),
  }),
})

export const {
  useReservationInfoQuery,
  useGuestReservationFloorQuery,
  useGuestRestaurantMenuQuery,
  useCreateReservationMutation,
  useUpdateReservationItemsMutation,
  useUpdateReservationNotesMutation,
  useCheckoutReservationMutation,
  useReservationQuery,
  useGuestCancelReservationMutation,
  useTableReservationQuery,
  useCheckInReservationMutation,
  useSubmitServiceFeedbackMutation,
} = reservationsApi
