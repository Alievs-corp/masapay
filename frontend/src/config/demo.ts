// Public demo entry points shown on /demo. The reservation page of the demo
// restaurant is public. A table link carries that table's QR token, so it is
// not kept in the code: set VITE_DEMO_TABLE_URL at build time to show it.
const DEMO_RESTAURANT = '6e639cbd-89ba-41f1-aa78-d779825d7f4e'

export const DEMO_LINKS = {
  reserve: `/r/${DEMO_RESTAURANT}/reserve`,
  table: (import.meta.env.VITE_DEMO_TABLE_URL as string | undefined) || null,
  staffLogin: '/admin/login',
} as const
