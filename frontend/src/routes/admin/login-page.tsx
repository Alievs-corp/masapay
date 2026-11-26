import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CircleAlert, Eye, EyeOff, LoaderCircle, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '@/app/hooks'
import { BrandMark } from '@/components/layout/brand-mark'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { type LoginResponse, useLoginMutation } from '@/features/auth/auth-api'
import { DevLoginButtons } from '@/features/auth/dev-login-buttons'
import { tokenReceived } from '@/features/auth/auth-slice'
import { useSession } from '@/features/auth/use-session'
import { httpStatus } from '@/lib/api-errors'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginProblem = 'invalid' | 'tooMany' | 'failed' | null

function problemOf(error: unknown): LoginProblem {
  const status = httpStatus(error as Parameters<typeof httpStatus>[0])
  if (status === 401) return 'invalid'
  if (status === 429) return 'tooMany'
  return 'failed'
}

// Admin sign-in with email and password. The backend answers with an access
// token (kept in memory) and sets the refresh cookie. Nobody signs up: a super
// admin or a restaurant manager creates each account.
export function LoginPage() {
  const { t } = useTranslation('auth')
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useSession()
  const [login, { isLoading }] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [problem, setProblem] = useState<LoginProblem>(null)

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/admin'

  if (status === 'authenticated') {
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) return
    setProblem(null)
    try {
      finish(await login({ email: email.trim(), password }).unwrap())
    } catch (error) {
      setProblem(problemOf(error))
    }
  }

  function finish(response: LoginResponse) {
    dispatch(
      tokenReceived({
        accessToken: response.tokens.accessToken,
        user: {
          id: response.userId,
          email: response.email,
          role: response.role,
        },
      }),
    )
    navigate(from, { replace: true })
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4 sm:p-6">
      <LanguageSwitcher className="absolute right-4 top-4 bg-background sm:right-6 sm:top-6" />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandMark className="mb-2 h-12" />
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="space-y-4"
            aria-label={t('login.form')}
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="login-email">{t('login.email')}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t('login.password')}</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={128}
                  className="pr-11"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={
                    showPassword
                      ? t('login.hidePassword')
                      : t('login.showPassword')
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            </div>

            {problem && (
              <p
                role="alert"
                className="flex items-start gap-2 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t(`login.${problem}`)}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email.trim() || !password}
            >
              {isLoading ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <LogIn aria-hidden />
              )}
              {isLoading ? t('login.checking') : t('login.submit')}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {t('login.noAccount')}
          </p>

          {import.meta.env.DEV && <DevLoginButtons onResponse={finish} />}
        </CardContent>
      </Card>
    </main>
  )
}
