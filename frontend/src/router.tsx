import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LandingPage } from '@/routes/landing-page'
import { DemoPage } from '@/routes/demo-page'
import { TablePage } from '@/routes/table-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { PaymentResultPage } from '@/routes/payment-result-page'
import { MockPayriffPage } from '@/routes/mock-payriff-page'
import { ReservePage } from '@/routes/reserve-page'
import { ReservationPage } from '@/routes/reservation-page'
import { LoginPage } from '@/routes/admin/login-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { AdminLayout } from '@/features/admin/admin-layout'

// Admin panel is lazy-loaded so its charting bundle (recharts) stays out of the
// customer PWA's initial download.
const DashboardPage = lazy(() =>
  import('@/routes/admin/dashboard-page').then((m) => ({
    default: m.DashboardPage,
  })),
)
const TablesPage = lazy(() =>
  import('@/routes/admin/tables-page').then((m) => ({
    default: m.TablesPage,
  })),
)
const LiveTablesPage = lazy(() =>
  import('@/routes/admin/live-tables-page').then((m) => ({
    default: m.LiveTablesPage,
  })),
)
const TransactionsPage = lazy(() =>
  import('@/routes/admin/transactions-page').then((m) => ({
    default: m.TransactionsPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/routes/admin/settings-page').then((m) => ({
    default: m.SettingsPage,
  })),
)
const TipsPage = lazy(() =>
  import('@/routes/admin/tips-page').then((m) => ({
    default: m.TipsPage,
  })),
)
const RestaurantsPage = lazy(() =>
  import('@/routes/admin/restaurants-page').then((m) => ({
    default: m.RestaurantsPage,
  })),
)
const MyTipsPage = lazy(() =>
  import('@/routes/admin/my-tips-page').then((m) => ({
    default: m.MyTipsPage,
  })),
)
const PlatformAnalyticsPage = lazy(() =>
  import('@/routes/admin/platform-analytics-page').then((m) => ({
    default: m.PlatformAnalyticsPage,
  })),
)
const AccountsPage = lazy(() =>
  import('@/routes/admin/accounts-page').then((m) => ({
    default: m.AccountsPage,
  })),
)
const StaffPage = lazy(() =>
  import('@/routes/admin/staff-page').then((m) => ({
    default: m.StaffPage,
  })),
)
const OrdersPage = lazy(() =>
  import('@/routes/admin/orders-page').then((m) => ({
    default: m.OrdersPage,
  })),
)
const KitchenPage = lazy(() =>
  import('@/routes/admin/kitchen-page').then((m) => ({
    default: m.KitchenPage,
  })),
)
const ReservationsPage = lazy(() =>
  import('@/routes/admin/reservations-page').then((m) => ({
    default: m.ReservationsPage,
  })),
)
const FeedbackPage = lazy(() =>
  import('@/routes/admin/feedback-page').then((m) => ({
    default: m.FeedbackPage,
  })),
)
const MenuPage = lazy(() =>
  import('@/routes/admin/menu-page').then((m) => ({
    default: m.MenuPage,
  })),
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    // Live demo hub: every "Request a demo" button opens it.
    path: '/demo',
    element: <DemoPage />,
  },
  // Short addresses people type for the demo: guests go to the hub, staff to
  // the sign-in page.
  ...['/user', '/users', '/customer', '/guest', '/musteri'].map((path) => ({
    path,
    element: <Navigate to="/demo" replace />,
  })),
  ...['/staff', '/waiter', '/ofisiant', '/manager', '/login'].map((path) => ({
    path,
    element: <Navigate to="/admin/login" replace />,
  })),
  {
    // Reached by scanning a table QR code.
    path: '/r/:restaurantSlug/t/:tableId',
    element: <TablePage />,
  },
  {
    // Public table reservation with an optional pre-order.
    path: '/r/:restaurantSlug/reserve',
    element: <ReservePage />,
  },
  {
    // A guest's reservation, reached by its public code.
    path: '/reservation/:code',
    element: <ReservationPage />,
  },
  {
    // Payriff sends the guest back here after paying (#37).
    path: '/payment/result',
    element: <PaymentResultPage />,
  },
  {
    // Local stand-in for Payriff's page; only in development (#37).
    path: '/payment/mock',
    element: import.meta.env.DEV ? <MockPayriffPage /> : <NotFoundPage />,
  },
  {
    path: '/admin/login',
    element: <LoginPage />,
  },
  {
    // Admin panel: only signed-in managers and super admins (#17).
    path: '/admin',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <DashboardPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Tables and QR codes: managers and waiters (#47).
    path: '/admin/tables',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <TablesPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // The platform's restaurants: super admin only (#147).
    path: '/admin/restaurants',
    element: (
      <RequireAuth roles={['SUPER_ADMIN']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <RestaurantsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // The whole platform's numbers: super admin only (#149).
    path: '/admin/analytics',
    element: (
      <RequireAuth roles={['SUPER_ADMIN']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <PlatformAnalyticsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Every account on the platform: super admin only.
    path: '/admin/accounts',
    element: (
      <RequireAuth roles={['SUPER_ADMIN']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <AccountsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // A waiter's own tips with the table of each (#182).
    path: '/admin/my-tips',
    element: (
      <RequireAuth roles={['WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <MyTipsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Waiters and chefs of the restaurant: managers (#145).
    path: '/admin/staff',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <StaffPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Orders per table with payment state: waiters and managers (#143).
    path: '/admin/orders',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <OrdersPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Kitchen screen: chefs and managers (#142).
    path: '/admin/kitchen',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'CHEF']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <KitchenPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Menu: managers edit it, waiters read it (#137).
    path: '/admin/menu',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <MenuPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Live floor plan: managers and waiters (#44).
    path: '/admin/live',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <LiveTablesPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Payments and refunds (#45).
    path: '/admin/transactions',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <TransactionsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Restaurant settings for managers; every role changes its password here.
    path: '/admin/settings',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER', 'CHEF']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <SettingsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Tip report per waiter with CSV export (#48).
    path: '/admin/tips',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <TipsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Reservations of the day with the floor map: managers and waiters.
    path: '/admin/reservations',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <ReservationsPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    // Guests' service ratings out of 10: managers.
    path: '/admin/feedback',
    element: (
      <RequireAuth roles={['SUPER_ADMIN', 'RESTO_MANAGER']}>
        <AdminLayout>
          <Suspense fallback={null}>
            <FeedbackPage />
          </Suspense>
        </AdminLayout>
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
