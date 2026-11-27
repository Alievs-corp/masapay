// API contract of reservations, table locations and service feedback.
// Mirrors docs/RESERVATIONS-SPEC.md; money is a JSON number, totals always come from the server.

export type TableKind = 'TABLE' | 'CABIN'

export type ReservationStatus =
  'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export type ReservationPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'

export type ReservationSource = 'CUSTOMER' | 'STAFF'

export type DepositType = 'NONE' | 'FIXED' | 'PERCENT'

export type FloorTableState = 'FREE' | 'RESERVED' | 'OCCUPIED'

/** A table's place in the restaurant; x, y, w, h are on a 0-100 grid per floor. */
export interface TableLocation {
  kind: TableKind
  floor: number
  zone: string | null
  locationDescription: string | null
  seats: number
  x: number
  y: number
  w: number
  h: number
}

export interface ReservationTable extends TableLocation {
  tableId: string
  label: string
}

export interface FloorTable extends ReservationTable {
  state: FloorTableState
  fitsParty: boolean
  /** Only in staff responses: the reservation that makes the table RESERVED. */
  reservationId?: string | null
}

export interface ReservationRules {
  enabled: boolean
  bookingWindowDays: number
  holdMinutes: number
  defaultDurationMinutes: number
  depositType: DepositType
  depositValue: number
  freeCancelHours: number
  lateCancelRefundPercent: number
  noShowRefundPercent: number
}

export interface ReservationInfo {
  restaurantId: string
  restaurantName: string
  currency: string
  timeZone: string
  /** YYYY-MM-DD in the restaurant time zone. */
  today: string
  lastBookableDate: string
  rules: ReservationRules
  floors: number[]
}

export interface FloorAvailability {
  date: string
  time: string
  floors: number[]
  tables: FloorTable[]
}

export interface ReservationItemRequest {
  menuItemId: string
  quantity: number
}

export interface CreateReservationRequest {
  tableId: string
  /** YYYY-MM-DD, restaurant time zone. */
  date: string
  /** HH:mm, restaurant time zone. */
  time: string
  partySize: number
  guestName: string
  guestPhone: string
  note?: string | null
  durationMinutes?: number | null
  items?: ReservationItemRequest[]
}

export interface ReservationItem {
  id: string
  menuItemId: string | null
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface ReservationPolicy {
  holdMinutes: number
  freeCancelUntil: string
  lateCancelRefundPercent: number
  noShowRefundPercent: number
  depositType: DepositType
  depositValue: number
}

export interface ReservationView {
  id: string
  code: string
  restaurantId: string
  restaurantName: string
  status: ReservationStatus
  paymentStatus: ReservationPaymentStatus
  source: ReservationSource
  /** ISO instants. */
  startsAt: string
  endsAt: string
  validUntil: string
  localDate: string
  localTime: string
  partySize: number
  guestName: string
  /** Masked in public responses, full in staff responses. */
  guestPhone: string
  note: string | null
  table: ReservationTable
  floorTables: FloorTable[]
  items: ReservationItem[]
  currency: string
  itemsTotal: number
  depositAmount: number
  amountDue: number
  amountToPayNow: number
  paidAmount: number
  refundedAmount: number
  remaining: number
  policy: ReservationPolicy
  canCancel: boolean
  canPay: boolean
  canEditItems: boolean
  seatedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
}

export interface ReservationCheckoutRequest {
  payFull?: boolean
}

export interface CancelReservationRequest {
  reason?: string
  /** Staff only, managers: refund everything regardless of the policy. */
  fullRefund?: boolean
}

/** Sent to /topic/restaurants/{restaurantId}/reservations. */
export interface ReservationChangedMessage {
  type: 'RESERVATION_CHANGED'
  reservationId: string
  localDate: string
}

export type PaymentKind = 'TABLE_BILL' | 'RESERVATION'

export interface FeedbackSubmitRequest {
  transactionId: string
  /** 1-10; a note is required for 6 or lower. */
  score: number
  note?: string | null
}

export interface FeedbackView {
  id: string
  score: number
  note: string | null
  createdAt: string
}

export interface FeedbackEntry {
  id: string
  score: number
  note: string | null
  tableLabel: string | null
  kind: PaymentKind
  reservationCode: string | null
  amountPaid: number
  currency: string
  createdAt: string
}

export interface FeedbackList {
  /** Out of 10, one decimal; null when there is no feedback. */
  averageScore: number | null
  count: number
  items: FeedbackEntry[]
}

/** Lowest score that does not need a note. */
export const FEEDBACK_NOTE_OPTIONAL_FROM = 7

// ---- Guest requests, allergies and the arrival view (spec section 11) ----

export const ALLERGENS = [
  'NUTS',
  'PEANUTS',
  'MILK',
  'GLUTEN',
  'EGGS',
  'FISH',
  'SHELLFISH',
  'SOY',
  'SESAME',
  'OTHER',
] as const

export type Allergen = (typeof ALLERGENS)[number]

export const OCCASIONS = [
  'BIRTHDAY',
  'ANNIVERSARY',
  'BUSINESS',
  'OTHER',
] as const

export type Occasion = (typeof OCCASIONS)[number]

/** Special requests of the guest, stored on the reservation. */
export interface GuestRequests {
  /** High chairs / child seats, 0-10. */
  childSeats: number
  wheelchair: boolean
  occasion: Occasion | null
  allergens: Allergen[]
  /** Free text about the allergy, at most 200 characters. */
  allergyNote: string | null
}

export const MAX_CHILD_SEATS = 10
export const MAX_ALLERGY_NOTE = 200
export const MAX_GUEST_NOTE = 500

export const EMPTY_GUEST_REQUESTS: GuestRequests = {
  childSeats: 0,
  wheelchair: false,
  occasion: null,
  allergens: [],
  allergyNote: null,
}

/** Body of PUT /api/public/reservations/{code}/notes. */
export interface UpdateReservationNotesRequest {
  note: string | null
  requests: GuestRequests
}

// Declaration merging: these add fields to the interfaces above (append-only file).
export interface CreateReservationRequest {
  requests?: GuestRequests | null
}

export interface ReservationView {
  /** Never null from an updated server; optional so an older one still renders. */
  requests?: GuestRequests | null
  /** CONFIRMED and before the start time (spec 11.1). */
  canEditNotes?: boolean
  /** Server clock at response time (ISO), for the countdown (spec 11, BACKEND). */
  serverNow?: string | null
}

// Staff-only extras (spec section 11, BACKEND part), added by the ADMIN builder.
export interface FloorTable {
  /** Staff floor only: allergies of the booking that makes the table RESERVED. */
  allergies?: Allergen[] | null
}

export interface ReservationView {
  /** Staff cancel / no-show only: REFUND_FAILED when Payriff refused the policy refund. */
  refundError?: string | null
}
