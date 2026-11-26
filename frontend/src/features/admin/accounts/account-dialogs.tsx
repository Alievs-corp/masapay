import { type FormEvent, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  type Account,
  useCreateAccountMutation,
  useUpdateAccountMutation,
} from '@/features/admin/accounts/accounts-api'
import type { RestaurantSummary } from '@/features/admin/settings/settings-api'
import type { UserRole } from '@/features/auth/auth-slice'
import { PasswordField } from '@/features/auth/password-field'
import { isValidPassword } from '@/features/auth/password-policy'
import { httpStatus } from '@/lib/api-errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLES: UserRole[] = ['SUPER_ADMIN', 'RESTO_MANAGER', 'WAITER', 'CHEF']

const EMAIL = /^\S+@\S+\.\S+$/

function needsRestaurant(role: UserRole | null): boolean {
  return role !== null && role !== 'SUPER_ADMIN'
}

/** Role select, and the restaurant select for every role but super admin. */
function RoleAndRestaurant({
  idPrefix,
  role,
  restaurantId,
  restaurants,
  onRole,
  onRestaurant,
  roleLocked = false,
}: {
  idPrefix: string
  role: UserRole | null
  restaurantId: string | null
  restaurants: RestaurantSummary[]
  onRole: (role: UserRole) => void
  onRestaurant: (id: string) => void
  roleLocked?: boolean
}) {
  const { t } = useTranslation('accounts')
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-role`}>{t('form.role')}</Label>
        <Select
          value={role ?? ''}
          onValueChange={(value) => onRole(value as UserRole)}
          disabled={roleLocked}
        >
          <SelectTrigger id={`${idPrefix}-role`}>
            <SelectValue placeholder={t('page.noRole')} />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`roles.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {needsRestaurant(role) && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-restaurant`}>
            {t('form.restaurant')}
          </Label>
          <Select value={restaurantId ?? ''} onValueChange={onRestaurant}>
            <SelectTrigger id={`${idPrefix}-restaurant`}>
              <SelectValue placeholder={t('form.chooseRestaurant')} />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!restaurantId && (
            <p className="text-xs text-muted-foreground">
              {t('form.restaurantRequired')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 text-sm text-destructive"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

/** A new account with any role; enabled at once. */
export function CreateAccountDialog({
  open,
  restaurants,
  onClose,
}: {
  open: boolean
  restaurants: RestaurantSummary[]
  onClose: () => void
}) {
  const { t } = useTranslation('accounts')
  const [create, createState] = useCreateAccountMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('RESTO_MANAGER')
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  const valid =
    name.trim() !== '' &&
    EMAIL.test(email.trim()) &&
    isValidPassword(password) &&
    (!needsRestaurant(role) || restaurantId !== null)

  function close() {
    setName('')
    setEmail('')
    setPassword('')
    setRole('RESTO_MANAGER')
    setRestaurantId(null)
    createState.reset()
    onClose()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    try {
      await create({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        restaurantId: needsRestaurant(role) ? restaurantId : null,
      }).unwrap()
      close()
    } catch {
      // createState.error is shown below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-lg">
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4"
          aria-label={t('form.createTitle')}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{t('form.createTitle')}</DialogTitle>
            <DialogDescription>{t('form.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-name">{t('form.name')}</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-email">{t('form.email')}</Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                autoComplete="off"
              />
            </div>
          </div>
          <PasswordField
            id="account-password"
            label={t('form.password')}
            value={password}
            onChange={setPassword}
            newPassword
          />
          <RoleAndRestaurant
            idPrefix="account"
            role={role}
            restaurantId={restaurantId}
            restaurants={restaurants}
            onRole={setRole}
            onRestaurant={setRestaurantId}
          />
          {createState.isError && (
            <Failure
              message={
                httpStatus(createState.error) === 409
                  ? t('form.emailTaken')
                  : t('form.createFailed')
              }
            />
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={!valid || createState.isLoading}>
              {createState.isLoading && (
                <LoaderCircle className="animate-spin" aria-hidden />
              )}
              {createState.isLoading ? t('form.creating') : t('form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Name, role and restaurant of an existing account. */
export function EditAccountDialog({
  account,
  isSelf,
  restaurants,
  onClose,
}: {
  account: Account | null
  isSelf: boolean
  restaurants: RestaurantSummary[]
  onClose: () => void
}) {
  return (
    <Dialog open={account !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {account && (
          // Keyed by account, so the form starts from that account's values.
          <EditAccountForm
            key={account.id}
            account={account}
            isSelf={isSelf}
            restaurants={restaurants}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditAccountForm({
  account,
  isSelf,
  restaurants,
  onClose,
}: {
  account: Account
  isSelf: boolean
  restaurants: RestaurantSummary[]
  onClose: () => void
}) {
  const { t } = useTranslation('accounts')
  const [update, updateState] = useUpdateAccountMutation()
  const [name, setName] = useState(account.name ?? '')
  const [role, setRole] = useState<UserRole | null>(account.role)
  const [restaurantId, setRestaurantId] = useState<string | null>(
    account.restaurantId,
  )

  const valid =
    name.trim() !== '' && (!needsRestaurant(role) || restaurantId !== null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    try {
      await update({
        id: account.id,
        name: name.trim(),
        role: role ?? undefined,
        restaurantId:
          needsRestaurant(role) && restaurantId ? restaurantId : undefined,
      }).unwrap()
      onClose()
    } catch {
      // updateState.error is shown below.
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-4"
      aria-label={t('form.editTitle')}
      noValidate
    >
      <DialogHeader>
        <DialogTitle>{t('form.editTitle')}</DialogTitle>
        <DialogDescription>
          {t('form.editDescription', { email: account.email })}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="edit-name">{t('form.name')}</Label>
        <Input
          id="edit-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
        />
      </div>
      <RoleAndRestaurant
        idPrefix="edit"
        role={role}
        restaurantId={restaurantId}
        restaurants={restaurants}
        onRole={setRole}
        onRestaurant={setRestaurantId}
        roleLocked={isSelf}
      />
      {isSelf && (
        <p className="text-xs text-muted-foreground">{t('page.ownAccount')}</p>
      )}
      {updateState.isError && (
        <Failure
          message={
            httpStatus(updateState.error) === 409
              ? t('page.ownAccount')
              : t('form.saveFailed')
          }
        />
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" disabled={!valid || updateState.isLoading}>
          {updateState.isLoading && (
            <LoaderCircle className="animate-spin" aria-hidden />
          )}
          {updateState.isLoading ? t('form.saving') : t('form.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
