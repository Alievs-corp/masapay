import { api } from '@/app/api'

// A restaurant's waiters and chefs, run by its manager (#145).

export type StaffRole = 'WAITER' | 'CHEF'

export type StaffStatus = 'ACTIVE' | 'DEACTIVATED'

export interface StaffMember {
  id: string
  email: string
  name: string | null
  role: StaffRole
  status: StaffStatus
  lastLoginAt: string | null
  /** False for an old account that has no password yet: it cannot sign in. */
  passwordSet: boolean
}

export interface NewStaffMember {
  restaurantId: string
  name: string
  email: string
  password: string
  role: StaffRole
}

const staffUrl = (restaurantId: string) =>
  `/admin/restaurants/${restaurantId}/staff`

export const staffApi = api.injectEndpoints({
  endpoints: (build) => ({
    restaurantStaff: build.query<StaffMember[], string>({
      query: (restaurantId) => staffUrl(restaurantId),
      providesTags: (_r, _e, restaurantId) => [
        { type: 'Staff', id: restaurantId },
      ],
    }),
    createStaff: build.mutation<StaffMember, NewStaffMember>({
      query: ({ restaurantId, ...body }) => ({
        url: staffUrl(restaurantId),
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'Staff', id: restaurantId },
        { type: 'Accounts', id: 'list' },
      ],
    }),
    updateStaff: build.mutation<
      StaffMember,
      {
        restaurantId: string
        userId: string
        role?: StaffRole
        active?: boolean
      }
    >({
      query: ({ restaurantId, userId, role, active }) => ({
        url: `${staffUrl(restaurantId)}/${userId}`,
        method: 'PATCH',
        body: { role, active },
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'Staff', id: restaurantId },
        { type: 'Accounts', id: 'list' },
      ],
    }),
    resetStaffPassword: build.mutation<
      void,
      { restaurantId: string; userId: string; newPassword: string }
    >({
      query: ({ restaurantId, userId, newPassword }) => ({
        url: `${staffUrl(restaurantId)}/${userId}/password`,
        method: 'PUT',
        body: { newPassword },
      }),
      invalidatesTags: (_r, _e, { restaurantId }) => [
        { type: 'Staff', id: restaurantId },
      ],
    }),
  }),
})

export const {
  useRestaurantStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useResetStaffPasswordMutation,
} = staffApi
