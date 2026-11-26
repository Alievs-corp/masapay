import type { Messages } from '@/i18n/messages'
import type az from '../az/auth'

const en: Messages<typeof az> = {
  login: {
    title: 'masapay admin',
    subtitle: 'Sign in with your email and password',
    form: 'Sign-in form',
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submit: 'Sign in',
    checking: 'Checking...',
    invalid: 'The email or password is wrong.',
    tooMany: 'Too many attempts. Please try again in a minute.',
    failed: 'Sign-in failed. Please try again.',
    noAccount:
      'No account yet? Your restaurant manager or a masapay administrator creates it for you.',
  },
  devLogin: {
    title: 'Local test sign-in (without a password)',
    admin: 'Test admin (SUPER_ADMIN)',
    manager: 'Test manager (Dolma Restoran)',
    waiter: 'Test waiter (Dolma Restoran)',
    chef: 'Test chef (Dolma Restoran)',
    failed:
      'Test sign-in failed. The backend must be started with MASAPAY_DEV_LOGIN_ENABLED=true.',
  },
  password: {
    show: '{{field}}: show',
    hide: '{{field}}: hide',
    hint: '{{min}} to {{max}} characters.',
    tooShort: 'Must be at least {{min}} characters.',
  },
  logout: 'Log out',
  guard: {
    checkingSession: 'Checking your session',
    noAccessTitle: 'You do not have access',
    noAccessBody:
      'This section is only for restaurant managers and administrators.',
  },
}

export default en
