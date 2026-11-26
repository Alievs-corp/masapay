import { type FormEvent, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PasswordField } from '@/features/auth/password-field'
import { isValidPassword } from '@/features/auth/password-policy'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Sets a new password for someone else's account (a super admin for anyone,
 * a manager for their waiters and chefs). `who` names the account; null
 * closes the dialog. `onSave` rejects when the request fails.
 */
export function ResetPasswordDialog({
  who,
  onSave,
  onClose,
  onDone,
}: {
  who: string | null
  onSave: (newPassword: string) => Promise<unknown>
  onClose: () => void
  /** After a successful save, before the dialog closes. */
  onDone?: (who: string) => void
}) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function close() {
    setPassword('')
    setFailed(false)
    onClose()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!who || !isValidPassword(password)) return
    setSaving(true)
    setFailed(false)
    try {
      await onSave(password)
      onDone?.(who)
      close()
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={who !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{t('resetPassword.title')}</DialogTitle>
            <DialogDescription>
              {t('resetPassword.description', { who })}
            </DialogDescription>
          </DialogHeader>
          <PasswordField
            id="reset-password"
            label={t('resetPassword.field')}
            value={password}
            onChange={setPassword}
            newPassword
          />
          {failed && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              {t('resetPassword.failed')}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('resetPassword.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!isValidPassword(password) || saving}
            >
              {saving && <LoaderCircle className="animate-spin" aria-hidden />}
              {saving ? t('resetPassword.saving') : t('resetPassword.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
