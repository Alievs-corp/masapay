import { api } from '@/app/api'
import type { FeedbackList } from '@/features/reservations/types'

// Service feedback guests leave after paying (docs/RESERVATIONS-SPEC.md):
// managers and super admins read it per restaurant.

export interface FeedbackFilter {
  restaurantId: string
  /** YYYY-MM-DD, Baku days. */
  from: string
  to: string
  minScore: number
  maxScore: number
}

export const feedbackApi = api.injectEndpoints({
  endpoints: (build) => ({
    serviceFeedback: build.query<FeedbackList, FeedbackFilter>({
      query: ({ restaurantId, ...params }) => ({
        url: `/admin/restaurants/${restaurantId}/feedback`,
        params,
      }),
    }),
  }),
})

export const { useServiceFeedbackQuery } = feedbackApi
