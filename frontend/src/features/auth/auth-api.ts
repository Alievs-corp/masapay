import { api } from '@/app/api'
import type { AuthUser, UserRole } from '@/features/auth/auth-slice'

interface AuthTokensDto {
  accessToken: string
  expiresInSeconds: number
}

/** POST /api/auth/login (and the local dev login) response. */
export interface LoginResponse {
  userId: string
  email: string
  name: string | null
  role: UserRole | null
  tokens: AuthTokensDto
}

export interface Credentials {
  email: string
  password: string
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Email and password sign-in; any refusal is a 401. */
    login: build.mutation<LoginResponse, Credentials>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
    }),
    /** LOCAL DEV ONLY: sign in as a seeded user by email (backend flag MASAPAY_DEV_LOGIN_ENABLED). */
    devLogin: build.mutation<LoginResponse, string>({
      query: (email) => ({
        url: '/auth/dev-login',
        method: 'POST',
        body: { email },
      }),
    }),
    /** New access token from the httpOnly refresh cookie (silent, no body). */
    refreshSession: build.mutation<AuthTokensDto, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    /** The signed-in user (id, email, role) from the access token. */
    me: build.query<AuthUser, void>({
      query: () => '/me',
      providesTags: ['Me'],
    }),
  }),
})

export const {
  useLoginMutation,
  useDevLoginMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
} = authApi
