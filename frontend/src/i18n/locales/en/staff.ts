import type { Messages } from '@/i18n/messages'
import type az from '../az/staff'

const en: Messages<typeof az> = {
  roles: {
    WAITER: 'Waiter',
    CHEF: 'Chef',
  },
  status: {
    ACTIVE: 'Active',
    DEACTIVATED: 'Deactivated',
  },
  page: {
    title: 'Staff',
    description:
      'Create waiter and chef accounts with a name, email and password: they can sign in at once. Hand the password over safely; they can change it in Settings.',
    createForm: 'Create a staff account',
    name: 'Name',
    namePlaceholder: 'First and last name',
    email: 'Email',
    emailPlaceholder: 'name.surname@mail.az',
    password: 'Password',
    role: 'Role',
    create: 'Create account',
    creating: 'Creating...',
    emailTaken: 'An account with this email already exists.',
    createFailed: 'Could not create the account. Check the details.',
    updateFailed: 'Could not save the change.',
    loading: 'Loading',
    loadFailed: 'Could not load the staff.',
    columns: {
      member: 'Staff member',
      role: 'Role',
      status: 'Status',
      actions: 'Actions',
    },
    noPassword: 'No password: set a new one',
    roleAria: 'Role of {{email}}',
    activateAria: 'Activate {{email}}',
    activate: 'Activate',
    deactivateAria: 'Deactivate {{email}}',
    deactivate: 'Deactivate',
    resetPasswordAria: 'New password for {{email}}',
    resetPassword: 'Password',
    empty: 'No staff yet. Create your first waiter or chef account above.',
  },
}

export default en
