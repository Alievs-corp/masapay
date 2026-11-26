import { useMemo, useState } from 'react'
import {
  CircleCheckBig,
  KeyRound,
  LoaderCircle,
  Pencil,
  Power,
  Search,
  UserCog,
  UserPlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/app/hooks'
import {
  CreateAccountDialog,
  EditAccountDialog,
} from '@/features/admin/accounts/account-dialogs'
import {
  type Account,
  useAccountsQuery,
  useResetAccountPasswordMutation,
  useUpdateAccountMutation,
} from '@/features/admin/accounts/accounts-api'
import { useMyRestaurantsQuery } from '@/features/admin/settings/settings-api'
import { ResetPasswordDialog } from '@/features/auth/reset-password-dialog'
import { httpStatus } from '@/lib/api-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function matches(account: Account, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    account.email.toLowerCase().includes(needle) ||
    (account.name ?? '').toLowerCase().includes(needle)
  )
}

// Every account on the platform, for the super admin: create one with any
// role and a password, switch it on or off, change its role, restaurant or
// name, and set a new password. Nobody signs themselves up.
export function AccountsPage() {
  const { t } = useTranslation('accounts')
  const { t: tAuth } = useTranslation('auth')
  const me = useAppSelector((state) => state.auth.user)
  const accounts = useAccountsQuery()
  const restaurants = useMyRestaurantsQuery()
  const [update, updateState] = useUpdateAccountMutation()
  const [resetPassword] = useResetAccountPasswordMutation()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [resetting, setResetting] = useState<Account | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  const restaurantNames = useMemo(
    () => new Map(restaurants.data?.map((r) => [r.id, r.name]) ?? []),
    [restaurants.data],
  )
  const shown = accounts.data?.filter((account) => matches(account, query))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UserCog className="size-6" aria-hidden />
            {t('page.title')}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus aria-hidden />
          {t('page.create')}
        </Button>
      </header>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="accounts-search">{t('page.search')}</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="accounts-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('page.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>

      {updateState.isError && (
        <p role="alert" className="text-sm text-destructive">
          {httpStatus(updateState.error) === 409
            ? t('page.ownAccount')
            : t('page.updateFailed')}
        </p>
      )}
      {resetDone && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-success"
        >
          <CircleCheckBig className="size-4" aria-hidden />
          {tAuth('resetPassword.done', { who: resetDone })}
        </p>
      )}

      {accounts.isLoading && (
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-label={t('page.loading')}
        />
      )}
      {accounts.isError && (
        <p className="text-sm text-destructive">{t('page.loadFailed')}</p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('page.columns.account')}</TableHead>
              <TableHead>{t('page.columns.role')}</TableHead>
              <TableHead>{t('page.columns.restaurant')}</TableHead>
              <TableHead>{t('page.columns.status')}</TableHead>
              <TableHead className="sr-only">
                {t('page.columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown?.map((account) => {
              const isSelf = account.id === me?.id
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <p className="font-medium">
                      {account.name ?? account.email}{' '}
                      {isSelf && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {t('page.you')}
                        </span>
                      )}
                    </p>
                    {account.name && (
                      <p className="text-xs text-muted-foreground">
                        {account.email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.role
                      ? t(`roles.${account.role}`)
                      : t('page.noRole')}
                  </TableCell>
                  <TableCell>
                    {account.restaurantId
                      ? (restaurantNames.get(account.restaurantId) ?? '-')
                      : t('page.noRestaurant')}
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Badge
                      variant={account.enabled ? 'success' : 'destructive'}
                    >
                      {account.enabled ? t('page.active') : t('page.inactive')}
                    </Badge>
                    {!account.passwordSet && (
                      <p className="text-xs text-muted-foreground">
                        {t('page.noPassword')}
                      </p>
                    )}
                    {account.passwordSet && !account.lastLoginAt && (
                      <p className="text-xs text-muted-foreground">
                        {t('page.neverSignedIn')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(account)}
                      aria-label={t('page.editAria', { email: account.email })}
                    >
                      <Pencil aria-hidden />
                      {t('page.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setResetDone(null)
                        setResetting(account)
                      }}
                      aria-label={t('page.resetPasswordAria', {
                        email: account.email,
                      })}
                    >
                      <KeyRound aria-hidden />
                      {t('page.resetPassword')}
                    </Button>
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant={account.enabled ? 'outline' : 'success'}
                        onClick={() =>
                          void update({
                            id: account.id,
                            enabled: !account.enabled,
                          })
                        }
                        aria-label={
                          account.enabled
                            ? t('page.deactivateAria', { email: account.email })
                            : t('page.activateAria', { email: account.email })
                        }
                      >
                        <Power aria-hidden />
                        {account.enabled
                          ? t('page.deactivate')
                          : t('page.activate')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {shown?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t('page.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateAccountDialog
        open={creating}
        restaurants={restaurants.data ?? []}
        onClose={() => setCreating(false)}
      />
      <EditAccountDialog
        account={editing}
        isSelf={editing?.id === me?.id}
        restaurants={restaurants.data ?? []}
        onClose={() => setEditing(null)}
      />
      <ResetPasswordDialog
        who={resetting ? (resetting.name ?? resetting.email) : null}
        onSave={async (newPassword) => {
          if (resetting) {
            await resetPassword({ id: resetting.id, newPassword }).unwrap()
          }
        }}
        onDone={setResetDone}
        onClose={() => setResetting(null)}
      />
    </div>
  )
}
