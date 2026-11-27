import type { Messages } from '@/i18n/messages'
import type az from '../az/landing'

const en: Messages<typeof az> = {
  nav: {
    product: 'Product',
    how: 'How it works',
    pricing: 'Pricing',
  },
  header: {
    openMenu: 'Open the menu',
    menu: 'Menu',
  },
  requestDemo: 'Request a demo',
  hero: {
    eyebrow: 'QR payments for restaurants',
    title:
      'A payment experience that saves time and brings 5 times more Google reviews.',
    body: 'Guests scan the QR code on the table, see the bill, split it, add a tip and pay in seconds.',
  },
  product: {
    title: 'Scan, split, pay.',
  },
  features: {
    qr: {
      title: 'Instant access by QR',
      body: 'No app to download: the QR code on the table opens the live bill.',
    },
    split: {
      title: 'Smart bill splitting',
      body: 'Pay in full, pay for what you ate or split evenly, all in one tap.',
    },
    reviews: {
      title: 'More Google reviews',
      body: 'After a successful payment, guests are led to leave a 5-star review.',
    },
  },
  stats: {
    reviews: { value: '5×', label: 'more Google reviews' },
    turnover: { value: '40%', label: 'faster table turnover' },
    payment: { value: '3 sec', label: 'average payment time' },
  },
  how: {
    title: 'Time for the experience, not for the staff.',
  },
  steps: {
    scan: { title: 'Scan', body: 'The guest scans the QR code on the table.' },
    split: {
      title: 'Split',
      body: 'They see the bill, split it and add a tip.',
    },
    pay: { title: 'Pay', body: 'They pay with Payriff in seconds.' },
  },
  demoPage: {
    eyebrow: 'Live demo',
    title: 'Try masapay now.',
    body: 'Open the demo restaurant as a guest or sign in as staff. Everything runs on the live site.',
    guest: 'As a guest',
    staff: 'As restaurant staff',
    staffNote:
      'For staff sign-in, use the email and password the restaurant gave you.',
    entries: {
      reserve: {
        title: 'Reserve a table',
        body: 'Pick a date, time and table, add a note, pre-order and pay.',
      },
      table: {
        title: 'QR menu at the table',
        body: 'Table M3: menu, order, bill, payment and feedback.',
      },
      waiter: {
        title: 'Waiter sign-in',
        body: 'Reservations, live tables, orders and the menu.',
      },
      manager: {
        title: 'Manager sign-in',
        body: 'Menu, tables, staff, payments and feedback.',
      },
    },
  },
  demo: {
    title: 'A live demo for your restaurant.',
    body: 'In a 15-minute demo we will show how masapay fits your restaurant.',
  },
}

export default en
