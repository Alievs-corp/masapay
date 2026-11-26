import { type FormEvent, useState } from 'react'
import {
  CircleAlert,
  CircleCheckBig,
  KeyRound,
  LoaderCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChangePasswordMutation } from '@/features/auth/auth-api'
import { PasswordField } from '@/features/auth/password-field'
import { isValidPassword } from '@/features/auth/password-policy'
import { problemReason } from '@/lib/api-errors'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Outcome = 'saved' | 'wrongCurrent' | 'failed' | null

/** Every signed-in user changes their own password: current one, then the new one twice. */
export function ChangePasswordForm() {
  const { t } = useTranslation('settings')
  const [change, { isLoading }] = useChangePasswordMutation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [outcome, setOutcome] = useState<Outcome>(null)

  const mismatch = repeat.length > 0 && repeat !== next
  const valid = current.length > 0 && isValidPassword(next) && repeat === next

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setOutcome(null)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    try {
      await change({ currentPassword: current, newPassword: next }).unwrap()
      setCurrent('')
      setNext('')
      setRepeat('')
      setOutcome('saved')
    } catch (error) {
      setOutcome(
        problemReason(error as Parameters<typeof problemReason>[0]) ===
          'CURRENT_PASSWORD_INCORRECT'
          ? 'wrongCurrent'
          : 'failed',
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" aria-hidden />
          {t('password.title')}
        </CardTitle>
        <CardDescription>{t('password.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="max-w-sm space-y-4"
          aria-label={t('password.title')}
          noValidate
        >
          <PasswordField
            id="current-password"
            label={t('password.current')}
            value={current}
            onChange={edit(setCurrent)}
            error={
              outcome === 'wrongCurrent' ? t('password.wrongCurrent') : null
            }
          />
          <PasswordField
            id="new-password"
            label={t('password.new')}
            value={next}
            onChange={edit(setNext)}
            newPassword
          />
          <PasswordField
            id="repeat-password"
            label={t('password.repeat')}
            value={repeat}
            onChange={edit(setRepeat)}
            error={mismatch ? t('password.mismatch') : null}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={!valid || isLoading}>
              {isLoading && (
                <LoaderCircle className="animate-spin" aria-hidden />
              )}
              {isLoading ? t('password.saving') : t('password.save')}
            </Button>
            {outcome === 'saved' && (
              <span
                role="status"
                className="flex items-center gap-2 text-sm text-success"
              >
                <CircleCheckBig className="size-4" aria-hidden />
                {t('password.saved')}
              </span>
            )}
            {outcome === 'failed' && (
              <span
                role="alert"
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <CircleAlert className="size-4" aria-hidden />
                {t('password.failed')}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
