import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/features/auth/password-policy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * A labelled password input with a show / hide toggle. With `newPassword` it
 * hints the policy (10 to 128 characters) and says when the text is too short.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  newPassword = false,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** A password being set (hint and length check) rather than one being proved. */
  newPassword?: boolean
  /** A message shown under the field instead of the hint. */
  error?: string | null
}) {
  const { t } = useTranslation('auth')
  const [shown, setShown] = useState(false)
  const tooShort =
    newPassword && value.length > 0 && value.length < PASSWORD_MIN_LENGTH
  const message =
    error ??
    (tooShort ? t('password.tooShort', { min: PASSWORD_MIN_LENGTH }) : null)
  const hintId = `${id}-hint`

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={PASSWORD_MAX_LENGTH}
          className="pr-11"
          aria-invalid={message ? true : undefined}
          aria-describedby={newPassword || message ? hintId : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          onClick={() => setShown((current) => !current)}
          aria-label={
            shown
              ? t('password.hide', { field: label })
              : t('password.show', { field: label })
          }
          aria-pressed={shown}
        >
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      {message ? (
        <p id={hintId} className="text-xs text-destructive">
          {message}
        </p>
      ) : (
        newPassword && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {t('password.hint', {
              min: PASSWORD_MIN_LENGTH,
              max: PASSWORD_MAX_LENGTH,
            })}
          </p>
        )
      )}
    </div>
  )
}
