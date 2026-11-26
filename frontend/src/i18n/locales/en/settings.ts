import type { Messages } from '@/i18n/messages'
import type az from '../az/settings'

const en: Messages<typeof az> = {
  page: {
    title: 'Settings',
    description: "The restaurant's service charge, POS and payment settings",
    staffDescription: 'Your account password',
    noRestaurant: 'No restaurant has been assigned to your account yet.',
    loading: 'Loading',
    loadFailed: 'Could not load the settings.',
  },
  serviceCharge: {
    title: 'Service charge',
    description:
      "When on, every bill gets a service charge of this percentage of the items' total, shown as a separate line on the customer's receipt.",
    enabled: 'Apply a service charge',
    percent: 'Percentage (%)',
    percentInvalid: 'Enter a percentage between 0 and 100, for example 10',
  },
  pos: {
    title: 'POS system',
    description:
      "The restaurant's till software. With iiko, bills are read from it and closed there automatically after payment.",
    iiko: 'iiko',
    micros: 'Micros',
    custom: 'Custom',
    iikoApiLogin: 'iiko API login',
    organizationId: 'Organization ID',
    paymentTypeId: 'ID of the masapay payment type',
    uuidInvalid: 'Must be a UUID',
  },
  payriff: {
    title: 'Payriff',
    description:
      'The secret key is never shown in full, only its last 4 characters.',
    merchantId: 'Merchant ID',
    secretKey: 'Secret Key',
    managedByPlatform:
      'Payriff payment settings (Merchant ID, Secret Key) are managed by the masapay platform. If you need a change, contact us.',
  },
  secret: {
    setHint: '{{masked}} (type a new one to change it)',
    notSet: 'Not set',
  },
  form: {
    saving: 'Saving...',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Could not save. Try again.',
  },
  password: {
    title: 'Change password',
    description:
      'Type your current password, then the new one twice. Use the new password the next time you sign in.',
    current: 'Current password',
    new: 'New password',
    repeat: 'New password (again)',
    mismatch: 'The passwords do not match.',
    wrongCurrent: 'The current password is wrong.',
    saving: 'Changing...',
    save: 'Change password',
    saved: 'The password has been changed.',
    failed: 'Could not change the password. Please try again.',
  },
}

export default en
