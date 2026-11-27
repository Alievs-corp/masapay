// Public demo entry points shown on /demo. They point at the demo restaurant
// on the live site; the table link is the same one its printed QR code opens.
const DEMO_RESTAURANT = '6e639cbd-89ba-41f1-aa78-d779825d7f4e'
const DEMO_TABLE = '6695c922-617e-40c6-87da-128bc7b15322'
const DEMO_TABLE_TOKEN = '6b88197c-cf79-44e4-ac41-44215c05ed43'

export const DEMO_LINKS = {
  reserve: `/r/${DEMO_RESTAURANT}/reserve`,
  table: `/r/${DEMO_RESTAURANT}/t/${DEMO_TABLE}?token=${DEMO_TABLE_TOKEN}`,
  staffLogin: '/admin/login',
} as const
