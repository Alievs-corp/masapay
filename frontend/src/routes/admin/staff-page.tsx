import { type FormEvent, useState } from 'react'
import {
  CircleCheckBig,
  KeyRound,
  LoaderCircle,
  Power,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMyRestaurantsQuery } from '@/features/admin/settings/settings-api'
import {
  type StaffMember,
  type StaffRole,
  type StaffStatus,
  useCreateStaffMutation,
  useResetStaffPasswordMutation,
  useRestaurantStaffQuery,
  useUpdateStaffMutation,
} from '@/features/admin/staff/staff-api'
import { PasswordField } from '@/features/auth/password-field'
import { isValidPassword } from '@/features/auth/password-policy'
import { ResetPasswordDialog } from '@/features/auth/reset-password-dialog'
import { httpStatus } from '@/lib/api-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// Labels are keys of the "staff" namespace, translated at render.
const ROLE_LABELS = {
  WAITER: 'roles.WAITER',
  CHEF: 'roles.CHEF',
} as const satisfies Record<StaffRole, string>

const STATUS = {
  ACTIVE: { label: 'status.ACTIVE', variant: 'success' },
  DEACTIVATED: { label: 'status.DEACTIVATED', variant: 'destructive' },
} as const satisfies Record<
  StaffStatus,
  { label: string; variant: 'success' | 'destructive' }
>

const EMAIL = /^\S+@\S+\.\S+$/

// Staff of a restaurant (#145): the manager creates waiter and chef accounts
// with a password (they can sign in at once), moves them between waiter and
// chef, switches them off or on and sets a new password when one is forgotten.
export function StaffPage() {
  const { t } = useTranslation('staff')
  const { t: tAuth } = useTranslation('auth')
  const restaurants = useMyRestaurantsQuery()
  const [chosen, setChosen] = useState<string | null>(null)
  const restaurantId = chosen ?? restaurants.data?.[0]?.id ?? null

  const staff = useRestaurantStaffQuery(restaurantId ?? '', {
    skip: !restaurantId,
  })
  const [create, createState] = useCreateStaffMutation()
  const [update, updateState] = useUpdateStaffMutation()
  const [resetPassword] = useResetStaffPasswordMutation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('WAITER')
  const [resetting, setResetting] = useState<StaffMember | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  const valid =
    name.trim() !== '' && EMAIL.test(email.trim()) && isValidPassword(password)

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!restaurantId || !valid) return
    try {
      await create({
        restaurantId,
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      }).unwrap()
      setName('')
      setEmail('')
      setPassword('')
    } catch {
      // createState.error is shown below.
    }
  }

  function change(
    member: StaffMember,
    patch: { role?: StaffRole; active?: boolean },
  ) {
    if (!restaurantId) return
    void update({ restaurantId, userId: member.id, ...patch })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('page.title')}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t('page.description')}
        </p>
      </header>

      {restaurants.data && restaurants.data.length > 1 && (
        <ToggleGroup
          type="single"
          value={restaurantId ?? undefined}
          onValueChange={(value) => value && setChosen(value)}
          className="flex-wrap justify-start"
        >
          {restaurants.data.map((restaurant) => (
            <ToggleGroupItem key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {restaurantId && (
        <form
          onSubmit={(event) => void onCreate(event)}
          className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start"
          aria-label={t('page.createForm')}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">{t('page.name')}</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('page.namePlaceholder')}
              maxLength={255}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">{t('page.email')}</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('page.emailPlaceholder')}
              maxLength={320}
              autoComplete="off"
            />
          </div>
          <PasswordField
            id="staff-password"
            label={t('page.password')}
            value={password}
            onChange={setPassword}
            newPassword
          />
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">{t('page.role')}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as StaffRole)}
            >
              <SelectTrigger id="staff-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as StaffRole[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(ROLE_LABELS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={!valid || createState.isLoading}>
              {createState.isLoading ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <UserPlus aria-hidden />
              )}
              {createState.isLoading ? t('page.creating') : t('page.create')}
            </Button>
          </div>
        </form>
      )}
      {createState.isError && (
        <p role="alert" className="text-sm text-destructive">
          {httpStatus(createState.error) === 409
            ? t('page.emailTaken')
            : t('page.createFailed')}
        </p>
      )}
      {updateState.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('page.updateFailed')}
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

      {staff.isLoading && (
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-label={t('page.loading')}
        />
      )}
      {staff.isError && (
        <p className="text-sm text-destructive">{t('page.loadFailed')}</p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('page.columns.member')}</TableHead>
              <TableHead>{t('page.columns.role')}</TableHead>
              <TableHead>{t('page.columns.status')}</TableHead>
              <TableHead className="sr-only">
                {t('page.columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.data?.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <p className="font-medium">{member.name ?? member.email}</p>
                  {member.name && (
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      change(member, { role: value as StaffRole })
                    }
                  >
                    <SelectTrigger
                      className="w-32"
                      aria-label={t('page.roleAria', { email: member.email })}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as StaffRole[]).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {t(ROLE_LABELS[value])}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="space-y-1">
                  <Badge variant={STATUS[member.status].variant}>
                    {t(STATUS[member.status].label)}
                  </Badge>
                  {!member.passwordSet && (
                    <p className="text-xs text-muted-foreground">
                      {t('page.noPassword')}
                    </p>
                  )}
                </TableCell>
                <TableCell className="space-x-1 whitespace-nowrap text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setResetDone(null)
                      setResetting(member)
                    }}
                    aria-label={t('page.resetPasswordAria', {
                      email: member.email,
                    })}
                  >
                    <KeyRound aria-hidden />
                    {t('page.resetPassword')}
                  </Button>
                  {member.status === 'DEACTIVATED' ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => change(member, { active: true })}
                      aria-label={t('page.activateAria', {
                        email: member.email,
                      })}
                    >
                      <UserCheck aria-hidden />
                      {t('page.activate')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => change(member, { active: false })}
                      aria-label={t('page.deactivateAria', {
                        email: member.email,
                      })}
                    >
                      <Power aria-hidden />
                      {t('page.deactivate')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {staff.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t('page.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResetPasswordDialog
        who={resetting ? (resetting.name ?? resetting.email) : null}
        onSave={async (newPassword) => {
          if (resetting && restaurantId) {
            await resetPassword({
              restaurantId,
              userId: resetting.id,
              newPassword,
            }).unwrap()
          }
        }}
        onDone={setResetDone}
        onClose={() => setResetting(null)}
      />
    </div>
  )
}
