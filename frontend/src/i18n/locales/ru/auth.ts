import type { Messages } from '@/i18n/messages'
import type az from '../az/auth'

const ru: Messages<typeof az> = {
  login: {
    title: 'masapay admin',
    subtitle: 'Войдите с email и паролем',
    form: 'Форма входа',
    email: 'Email',
    password: 'Пароль',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    submit: 'Войти',
    checking: 'Проверяем...',
    invalid: 'Неверный email или пароль.',
    tooMany: 'Слишком много попыток. Попробуйте снова через минуту.',
    failed: 'Не удалось войти. Попробуйте ещё раз.',
    noAccount:
      'Нет аккаунта? Его создаёт менеджер вашего ресторана или администратор masapay.',
  },
  devLogin: {
    title: 'Локальный тестовый вход (без пароля)',
    admin: 'Тестовый админ (SUPER_ADMIN)',
    manager: 'Тестовый менеджер (Dolma Restoran)',
    waiter: 'Тестовый официант (Dolma Restoran)',
    chef: 'Тестовый повар (Dolma Restoran)',
    failed:
      'Тестовый вход не удался. Backend нужно запустить с MASAPAY_DEV_LOGIN_ENABLED=true.',
  },
  password: {
    show: '{{field}}: показать',
    hide: '{{field}}: скрыть',
    hint: 'От {{min}} до {{max}} символов.',
    tooShort: 'Не меньше {{min}} символов.',
  },
  logout: 'Выйти',
  guard: {
    checkingSession: 'Проверяем сессию',
    noAccessTitle: 'У вас нет доступа',
    noAccessBody:
      'Этот раздел только для менеджеров ресторанов и администраторов.',
  },
}

export default ru
