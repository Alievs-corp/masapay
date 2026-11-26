import { api } from '@/app/api'
import type { UserRole } from '@/features/auth/auth-slice'

// Every account on the platform, run by the super admin: create with a
// password and any role, switch on or off, change role, restaurant or name,
// set a new password.

export interface Account {
  id: string
  email: string
  name: string | null
  /** Null only for an old account that was never given a role. */
  role: UserRole | null
  enabled: boolean
  /** Null for super admins. */
  restaurantId: string | null
  lastLoginAt: string | null
  /** False for an old account that has no password yet: it cannot sign in. */
  passwordSet: boolean
}

export interface NewAccount {
  email: string
  name: string
  password: string
  role: UserRole
  /** Required for every role but SUPER_ADMIN, which must have none. */
  restaurantId: string | null
}

export interface AccountChange {
  id: string
  enabled?: boolean
  role?: UserRole
  restaurantId?: string
  name?: string
}

const URL = '/admin/users'
const LIST = [{ type: 'Accounts' as const, id: 'list' }]
// Managers show on the platform's restaurant list and staff on the staff page.
const AFFECTED = [
  ...LIST,
  { type: 'Platform' as const, id: 'restaurants' },
  'Staff' as const,
]

export const accountsApi = api.injectEndpoints({
  endpoints: (build) => ({
    accounts: build.query<Account[], void>({
      query: () => URL,
      providesTags: LIST,
    }),
    createAccount: build.mutation<Account, NewAccount>({
      query: (body) => ({ url: URL, method: 'POST', body }),
      invalidatesTags: AFFECTED,
    }),
    updateAccount: build.mutation<Account, AccountChange>({
      query: ({ id, ...body }) => ({
        url: `${URL}/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: AFFECTED,
    }),
    resetAccountPassword: build.mutation<
      void,
      { id: string; newPassword: string }
    >({
      query: ({ id, newPassword }) => ({
        url: `${URL}/${id}/password`,
        method: 'PUT',
        body: { newPassword },
      }),
      invalidatesTags: LIST,
    }),
  }),
})

export const {
  useAccountsQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useResetAccountPasswordMutation,
} = accountsApi
