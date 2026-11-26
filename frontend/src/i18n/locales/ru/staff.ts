import type { Messages } from '@/i18n/messages'
import type az from '../az/staff'

const ru: Messages<typeof az> = {
  roles: {
    WAITER: 'Официант',
    CHEF: 'Повар',
  },
  status: {
    ACTIVE: 'Активен',
    DEACTIVATED: 'Отключён',
  },
  page: {
    title: 'Сотрудники',
    description:
      'Создайте аккаунты официантов и поваров с именем, email и паролем: войти можно сразу. Передайте пароль безопасным способом; сотрудник может сменить его в Настройках.',
    createForm: 'Создать аккаунт сотрудника',
    name: 'Имя',
    namePlaceholder: 'Имя и фамилия',
    email: 'Email',
    emailPlaceholder: 'imya.familiya@mail.az',
    password: 'Пароль',
    role: 'Роль',
    create: 'Создать аккаунт',
    creating: 'Создаём...',
    emailTaken: 'Аккаунт с таким email уже есть.',
    createFailed: 'Не удалось создать аккаунт. Проверьте данные.',
    updateFailed: 'Не удалось сохранить изменение.',
    loading: 'Загрузка',
    loadFailed: 'Не удалось загрузить сотрудников.',
    columns: {
      member: 'Сотрудник',
      role: 'Роль',
      status: 'Статус',
      actions: 'Действия',
    },
    noPassword: 'Нет пароля: задайте новый',
    roleAria: 'Роль {{email}}',
    activateAria: 'Включить {{email}}',
    activate: 'Включить',
    deactivateAria: 'Отключить {{email}}',
    deactivate: 'Отключить',
    resetPasswordAria: 'Новый пароль для {{email}}',
    resetPassword: 'Пароль',
    empty:
      'Сотрудников пока нет. Создайте первый аккаунт официанта или повара выше.',
  },
}

export default ru
