# Reservations, prepaid orders, 2D floor and service feedback (spec)

Branch `feature/reservations`. Three builders work in parallel: BACKEND, CUSTOMER, ADMIN.
Nobody edits a file owned by another builder (see "File ownership" at the end). The shared
skeleton (router entries, sidebar links, i18n namespaces, `features/reservations/types.ts`)
already exists; builders fill it in.

Project rules apply everywhere: no emoji, lucide-react icons, shadcn/ui, palette
`#FFFFFF / #000000 / #F6F5F6 / #0A0A0A`, accent `#08CB00` with black text, no gradients.
Money is `BigDecimal` (backend, scale 2, `RoundingMode.HALF_UP`), JSON numbers on the wire
(the frontend formats with `formatCurrency` from `@/features/order/format` and never sums floats
for totals it shows as authoritative: totals always come from the server). All reservation
times are in the restaurant zone `Asia/Baku` (`DashboardService.DASHBOARD_ZONE`); the API takes
local `date` (`YYYY-MM-DD`) + `time` (`HH:mm`) and returns `startsAt` / `endsAt` as ISO instants
plus `localDate` / `localTime` strings.

`restaurantSlug` in customer URLs is the restaurant id (UUID), exactly like the QR URL built by
`TableQrUrlBuilder` (`/r/{restaurantId}/t/{tableId}?token={qrToken}`).

---

## 1. Data model (Flyway; latest existing is V29)

### V30__add_table_location.sql

```sql
ALTER TABLE tables
    ADD COLUMN kind                 VARCHAR(10)  NOT NULL DEFAULT 'TABLE'
                                    CHECK (kind IN ('TABLE', 'CABIN')),
    ADD COLUMN floor                INTEGER      NOT NULL DEFAULT 1 CHECK (floor BETWEEN -5 AND 50),
    ADD COLUMN zone                 VARCHAR(50),
    ADD COLUMN location_description VARCHAR(255),
    ADD COLUMN seats                INTEGER      NOT NULL DEFAULT 4 CHECK (seats BETWEEN 1 AND 100),
    ADD COLUMN layout_x             NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (layout_x BETWEEN 0 AND 100),
    ADD COLUMN layout_y             NUMERIC(5,2) NOT NULL DEFAULT 0  CHECK (layout_y BETWEEN 0 AND 100),
    ADD COLUMN layout_w             NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (layout_w > 0 AND layout_w <= 100),
    ADD COLUMN layout_h             NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (layout_h > 0 AND layout_h <= 100);
```

Existing rows keep defaults; the service also clamps `x + w <= 100`, `y + h <= 100` (400 otherwise).
Entity: new fields on `RestaurantTable` (`TableKind kind`, `int floor`, `String zone`,
`String locationDescription`, `int seats`, `BigDecimal layoutX/Y/W/H`), enum
`az.masapay.domain.enums.TableKind { TABLE, CABIN }`.

### V31__add_restaurant_reservation_rules.sql

```sql
ALTER TABLE restaurants
    ADD COLUMN resv_enabled                    BOOLEAN       NOT NULL DEFAULT TRUE,
    ADD COLUMN resv_booking_window_days        INTEGER       NOT NULL DEFAULT 1   CHECK (resv_booking_window_days BETWEEN 0 AND 365),
    ADD COLUMN resv_hold_minutes               INTEGER       NOT NULL DEFAULT 30  CHECK (resv_hold_minutes BETWEEN 0 AND 600),
    ADD COLUMN resv_default_duration_minutes   INTEGER       NOT NULL DEFAULT 120 CHECK (resv_default_duration_minutes BETWEEN 15 AND 1440),
    ADD COLUMN resv_deposit_type               VARCHAR(10)   NOT NULL DEFAULT 'NONE'
                                               CHECK (resv_deposit_type IN ('NONE', 'FIXED', 'PERCENT')),
    ADD COLUMN resv_deposit_value              NUMERIC(12,2) NOT NULL DEFAULT 0   CHECK (resv_deposit_value >= 0),
    ADD COLUMN resv_free_cancel_hours          INTEGER       NOT NULL DEFAULT 2   CHECK (resv_free_cancel_hours BETWEEN 0 AND 720),
    ADD COLUMN resv_late_cancel_refund_percent NUMERIC(5,2)  NOT NULL DEFAULT 0   CHECK (resv_late_cancel_refund_percent BETWEEN 0 AND 100),
    ADD COLUMN resv_no_show_refund_percent     NUMERIC(5,2)  NOT NULL DEFAULT 0   CHECK (resv_no_show_refund_percent BETWEEN 0 AND 100);
```

`booking_window_days = 1` means today or tomorrow (days `0..N` from today, Baku). `PERCENT`
value is 0..100 of the pre-order total. Entity: `@Embedded ReservationRules reservationRules` on
`Restaurant` (`az.masapay.reservation.ReservationRules`, `@Embeddable`, columns above), enum
`DepositType { NONE, FIXED, PERCENT }`.

### V32__add_reservations.sql

```sql
CREATE TABLE reservations (
    id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id               UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    table_id                    UUID          NOT NULL REFERENCES tables (id) ON DELETE RESTRICT,
    code                        VARCHAR(12)   NOT NULL,          -- public access key, see below
    guest_name                  VARCHAR(100)  NOT NULL,
    guest_phone                 VARCHAR(30)   NOT NULL,
    party_size                  INTEGER       NOT NULL CHECK (party_size BETWEEN 1 AND 100),
    starts_at                   TIMESTAMPTZ   NOT NULL,
    ends_at                     TIMESTAMPTZ   NOT NULL,
    status                      VARCHAR(20)   NOT NULL DEFAULT 'CONFIRMED'
                                CHECK (status IN ('CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    payment_status              VARCHAR(20)   NOT NULL DEFAULT 'UNPAID'
                                CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')),
    source                      VARCHAR(10)   NOT NULL DEFAULT 'CUSTOMER' CHECK (source IN ('CUSTOMER', 'STAFF')),
    created_by                  UUID          REFERENCES users (id) ON DELETE SET NULL,
    note                        VARCHAR(500),
    currency                    CHAR(3)       NOT NULL DEFAULT 'AZN',
    items_total                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (items_total >= 0),
    deposit_amount              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    paid_amount                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    refunded_amount             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    -- policy snapshot taken at booking time, so later rule edits never change an existing booking
    hold_minutes                INTEGER       NOT NULL,
    free_cancel_until           TIMESTAMPTZ   NOT NULL,
    late_cancel_refund_percent  NUMERIC(5,2)  NOT NULL,
    no_show_refund_percent      NUMERIC(5,2)  NOT NULL,
    order_id                    UUID          REFERENCES orders (id) ON DELETE SET NULL,  -- set when seated
    seated_at                   TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    cancel_reason               VARCHAR(255),
    created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_reservations_code UNIQUE (code),
    CONSTRAINT ck_reservations_time CHECK (ends_at > starts_at)
);
CREATE INDEX idx_reservations_table_time      ON reservations (table_id, starts_at);
CREATE INDEX idx_reservations_restaurant_time ON reservations (restaurant_id, starts_at);
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservation_items (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID          NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
    menu_item_id    UUID          REFERENCES menu_items (id) ON DELETE SET NULL,
    name            VARCHAR(255)  NOT NULL,       -- copied from the menu at booking time
    quantity        INTEGER       NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price     NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservation_items_reservation ON reservation_items (reservation_id);
CREATE TRIGGER trg_reservation_items_updated_at BEFORE UPDATE ON reservation_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A reservation prepayment is a transaction without an order (yet).
ALTER TABLE transactions ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE transactions ADD COLUMN reservation_id UUID REFERENCES reservations (id) ON DELETE RESTRICT;
ALTER TABLE transactions ADD CONSTRAINT ck_transactions_target
    CHECK (order_id IS NOT NULL OR reservation_id IS NOT NULL);
ALTER TABLE transactions DROP CONSTRAINT transactions_split_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_split_type_check
    CHECK (split_type IN ('FULL', 'ITEM', 'EQUAL', 'RESERVATION'));
CREATE INDEX idx_transactions_reservation_id ON transactions (reservation_id);
```

(Verify the auto-generated constraint name `transactions_split_type_check` on a scratch DB first;
if it differs, look it up in `pg_constraint` and use that name.)

`code`: 10 characters from `SecureRandom` over the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(no 0/O/1/I), regenerated on the unlikely unique clash. It is the public capability for
`/reservation/:code`, like the table `qrToken`.

Entities (package `az.masapay.reservation`, extend `BaseEntity`): `Reservation`,
`ReservationItem` (`@OneToMany(mappedBy, cascade ALL, orphanRemoval)` from Reservation).
Enums in `az.masapay.domain.enums`: `ReservationStatus`, `ReservationPaymentStatus`,
`ReservationSource`, and `SplitType.RESERVATION` added. `Transaction` gets
`@ManyToOne(fetch LAZY) @JoinColumn(name="reservation_id") Reservation reservation` and its
`order` becomes `optional = true` / `nullable = true`.

**Null-order audit (required):** every `transaction.getOrder()` caller must handle a reservation
transaction: `PaymentStatusView`, `PaymentSettlementService.settlePending`, `TransactionRow`
(transactions admin list), `KitchenLineView` / `KitchenService`, dashboard/tip/report queries
(JPQL joins on `t.order` must become `LEFT JOIN` or filter `t.order IS NOT NULL`). Run
`grep -rn "getOrder()\|\.order\b" backend/src/main/java` and fix every hit.

### V33__add_service_feedback.sql

```sql
CREATE TABLE service_feedback (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    table_id        UUID          REFERENCES tables (id) ON DELETE SET NULL,
    order_id        UUID          REFERENCES orders (id) ON DELETE SET NULL,
    reservation_id  UUID          REFERENCES reservations (id) ON DELETE SET NULL,
    transaction_id  UUID          NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    score           SMALLINT      NOT NULL CHECK (score BETWEEN 1 AND 10),
    note            VARCHAR(1000),
    amount_paid     NUMERIC(12,2) NOT NULL,       -- transaction total_amount at the time
    currency        CHAR(3)       NOT NULL DEFAULT 'AZN',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_feedback_transaction UNIQUE (transaction_id),
    CONSTRAINT ck_service_feedback_note CHECK (score > 6 OR (note IS NOT NULL AND length(btrim(note)) > 0))
);
CREATE INDEX idx_service_feedback_restaurant_time ON service_feedback (restaurant_id, created_at);
CREATE TRIGGER trg_service_feedback_updated_at BEFORE UPDATE ON service_feedback
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Entity `az.masapay.feedback.ServiceFeedback`.

---

## 2. Status machine

```
                 seat (staff, or guest check-in with code at the table)
   CONFIRMED  ─────────────────────────────►  SEATED ──(table order PAID/CLOSED, or staff "complete")──► COMPLETED
      │   │
      │   └── now > startsAt + holdMinutes and not seated (scheduler every minute + on read) ──► NO_SHOW
      └── cancel (guest before start, or staff any time before SEATED) ──► CANCELLED
```

- A reservation is created directly as `CONFIRMED` (customer and staff). There is no
  `PENDING_PAYMENT` state (user rule 8: payment is never forced; an abandoned payment leaves it
  `CONFIRMED` + `UNPAID`). The frontend type still lists no `PENDING_PAYMENT`.
- `paymentStatus` (independent):
  - `amountDue = max(itemsTotal, depositAmount)`; `depositAmount` = `FIXED` value, or
    `PERCENT` of `itemsTotal` (HALF_UP, 2 dp), or 0 for `NONE`.
  - `amountToPayNow = depositAmount > 0 ? depositAmount : itemsTotal` (the guest may also pay
    the whole `amountDue`; checkout takes `payFull: boolean`).
  - `remaining = amountDue - paidAmount` (never below 0).
  - `UNPAID` when `paidAmount == 0` and `amountDue > 0`; `PAID` when `paidAmount >= amountDue`
    (also when `amountDue == 0`); otherwise `PARTIALLY_PAID`.
- Allowed transitions only; anything else is `409 Conflict` with reason
  `RESERVATION_STATE`. Terminal: COMPLETED, CANCELLED, NO_SHOW.
- Refund on cancel: before `freeCancelUntil` refund 100 % of `paidAmount`; after it refund
  `lateCancelRefundPercent`; on NO_SHOW refund `noShowRefundPercent`. Staff cancel uses the same
  rule unless the staff request sets `fullRefund: true` (managers only).
- Overlap: two reservations on the same table overlap when
  `a.startsAt < b.endsAt AND b.startsAt < a.endsAt` and both are in `CONFIRMED` or `SEATED`.
  Checked inside the create transaction after `SELECT ... FOR UPDATE` on the `tables` row
  (`RestaurantTableRepository.findByIdForUpdate`, add it), `409` reason `RESERVATION_OVERLAP`.
- Customer window: `localDate` must be in `[today, today + bookingWindowDays]` (Baku) and the
  start must be in the future (`> now`), else `400` reason `OUTSIDE_BOOKING_WINDOW` /
  `START_IN_PAST`. Staff endpoints skip the window (still reject `START_IN_PAST` older than
  1 hour and still reject overlap). `partySize > seats` -> `400` `PARTY_TOO_LARGE`.
- `endsAt = startsAt + durationMinutes` (request may pass `durationMinutes`, default
  `resv_default_duration_minutes`).

---

## 3. Payment reuse (exact classes)

Start (in `PaymentCheckoutService`, BACKEND adds a public method so the private `start(...)` is reused):

```java
public CheckoutResponse checkoutReservation(String code, boolean payFull)
// loads Reservation by code (404), requires status CONFIRMED, amount = payFull ? remaining : min(amountToPayNow - paid, remaining) (> 0 else 409 NOTHING_TO_PAY),
// builds Transaction: order=null, reservation=r, restaurant=r.restaurant, amount=amount, tipAmount=0,
// totalAmount=amount, currency=r.currency, splitType=RESERVATION, status=PENDING; return start(tx)
```

`start` -> `PayriffService.startCheckout(tx)` (mock page `/payment/mock` in dev, unchanged) ->
Payriff/mock calls back -> `PayriffWebhookService.apply(txId, orderId, status)`. BACKEND changes
`apply`: when `APPROVED` and `transaction.getReservation() != null`, call
`ReservationPaymentService.settle(transaction)` instead of `settlementService.settlePending`.
`settle` marks the transaction `SUCCESS` + `paidAt`, adds `amount` to `reservation.paidAmount`,
recomputes `paymentStatus`, and if the reservation is already SEATED re-links the transaction to
`reservation.order` (see section 4) and calls `PaymentSettlementService.settleIfFullyPaid(order)`.
Then it broadcasts the reservation event (section 6). FAILED handling is unchanged (the
reservation stays CONFIRMED / UNPAID).

Result page: Payriff returns the guest to `/payment/result?tx=<transactionId>` (unchanged).
`PaymentStatusView` gains two nullable fields: `reservationCode` and `kind`
(`"TABLE_BILL" | "RESERVATION"`); for a reservation `orderStatus`, `qrToken` are null and
`tableId` is the reservation table. The result page (CUSTOMER) shows the feedback step, then
links to `/reservation/{reservationCode}` for a reservation, or back to the bill otherwise.

Refunds by policy: BACKEND adds to `RefundService`
`RefundResult refundAmount(Transaction tx, BigDecimal amount, String reason)` (system call, no
role check, `@Transactional(propagation = MANDATORY)`): partial refund via
`PayriffClient.refund(new PayriffRefundRequest(orderId, amount, reason))`; skips the Payriff call
when `payriffOrderId` starts with `PayriffService.MOCK_ORDER_PREFIX` (dev); sets
`refundedAmount += amount`, status `REFUNDED` only when the whole total is refunded. Spread the
refund over the reservation's SUCCESS transactions newest first. A Payriff failure leaves the
reservation cancelled and logs a warning; the response carries `refundError` so staff can refund
manually from /admin/transactions.

---

## 4. Seating: prepaid items join the table bill

`ReservationSeatingService.seat(Reservation r, User staffOrNull)` (`@Transactional`):

1. Require `CONFIRMED` and `now >= startsAt - 60 min` (else 409 `TOO_EARLY`).
2. `OpenBillWriter.append(table, lines)` with one `NewLine(name, quantity, unitPrice, menuItem,
   addedBy = null)` per reservation item (skip when there are none, but still open the bill:
   if the table has no open order, append opens one only when lines exist, so for an empty
   pre-order and `paidAmount > 0` BACKEND opens the order through the same writer by adding a
   public `Order openOrFind(RestaurantTable)` to `OpenBillWriter`). Dishes go to the kitchen
   (KitchenStatus.NEW) and to POS exactly like any other appended line.
3. Load the open order (`orderRepository.findOpenOrderForUpdate(tableId)`), set
   `reservation.order = order`, and for every SUCCESS reservation transaction set
   `tx.order = order` (keep `tx.reservation`). Because `PaymentSettlementService.outstanding()`
   sums SUCCESS transactions by order, the prepayment now pays the bill down automatically.
4. If `paymentStatus == PAID` and `paidAmount >= itemsTotal`, mark the appended `OrderItem`s
   `paid = true`, `paidTransaction` = the latest reservation transaction, so ITEM split never
   charges them again.
5. `status = SEATED`, `seatedAt = now`; broadcast the bill (`OrderRealtimeBroadcaster
   .broadcastOrderUpdate(qrToken)`, already called by append) and the reservation event.
6. Do NOT call `settleIfFullyPaid` here: the bill stays open so guests can keep ordering.

The customer bill (`OrderView` in `TableOrderResponse`) gains nullable
`reservation: { code, guestName, prepaidAmount }` and each `OrderItemView` gains
`fromReservation: boolean` (BACKEND), so the table page shows "Prepaid with reservation" and the
existing paid / outstanding numbers.

COMPLETED: when the linked order becomes PAID or CLOSED (listen to `OrderPaidEvent`), or staff
press "Complete".

---

## 5. REST endpoints

Conventions as today: public under `/api/public/**` (no auth), staff under
`/api/admin/restaurants/{restaurantId}/...` with `@PreAuthorize` and the existing
`RestaurantGate` access check; controllers guarded with the same
`@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", ...)`. Errors are
`ResponseStatusException` with the reason codes named in this spec.

### Public (customer)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/public/restaurants/{restaurantId}/reservations/info` | - | `ReservationInfo` |
| GET | `/api/public/restaurants/{restaurantId}/reservations/floor` | `?date=YYYY-MM-DD&time=HH:mm&partySize=2` | `FloorAvailability` |
| GET | `/api/public/restaurants/{restaurantId}/menu` | - | `MenuCategoryView[]` (same as `/tables/{qrToken}/menu`; add `MenuService.customerMenuOfRestaurant(id)`) |
| POST | `/api/public/restaurants/{restaurantId}/reservations` | `CreateReservationRequest` | `201 ReservationView` |
| GET | `/api/public/reservations/{code}` | - | `ReservationView` (expires to NO_SHOW on read) |
| PUT | `/api/public/reservations/{code}/items` | `{ items: [{ menuItemId, quantity }] }` | `ReservationView` (only CONFIRMED and paidAmount == 0, else 409 `ITEMS_LOCKED`) |
| POST | `/api/public/reservations/{code}/checkout` | `{ payFull?: boolean }` | `CheckoutResponse { transactionId, paymentUrl }` |
| POST | `/api/public/reservations/{code}/cancel` | `{ reason?: string }` | `ReservationView` |
| GET | `/api/public/tables/{qrToken}/reservation` | `?code=XXXX` (required) | `ReservationView` or `204` when the code does not belong to this table or the time is outside `[startsAt - 60 min, startsAt + holdMinutes]` (SEATED also returns it) |
| POST | `/api/public/tables/{qrToken}/reservation/check-in` | `{ code }` | `ReservationView` (seats it, section 4) |
| POST | `/api/public/feedback` | `{ transactionId, score, note? }` | `201 FeedbackView`; 409 `FEEDBACK_EXISTS`; 400 `NOTE_REQUIRED` for score <= 6 without note; 409 `PAYMENT_NOT_SUCCESSFUL` unless tx SUCCESS |

### Staff (SUPER_ADMIN, RESTO_MANAGER, WAITER unless noted)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/admin/restaurants/{rid}/reservations` | `?date=YYYY-MM-DD` | `ReservationView[]` (with `guestPhone`) |
| GET | `/api/admin/restaurants/{rid}/reservations/floor` | `?date=&time=` | `FloorAvailability` |
| GET | `/api/admin/restaurants/{rid}/reservations/{id}` | - | `ReservationView` |
| POST | `/api/admin/restaurants/{rid}/reservations` | `CreateReservationRequest` (+ `items` allowed) | `201 ReservationView` (`source=STAFF`, no window limit) |
| POST | `/api/admin/restaurants/{rid}/reservations/{id}/seat` | - | `ReservationView` |
| POST | `/api/admin/restaurants/{rid}/reservations/{id}/complete` | - | `ReservationView` |
| POST | `/api/admin/restaurants/{rid}/reservations/{id}/cancel` | `{ reason?, fullRefund? }` (`fullRefund` managers only) | `ReservationView` |
| POST | `/api/admin/restaurants/{rid}/reservations/{id}/no-show` | - | `ReservationView` |
| GET | `/api/admin/restaurants/{rid}/reservation-rules` | - | `ReservationRules` |
| PUT | `/api/admin/restaurants/{rid}/reservation-rules` | `ReservationRules` | `ReservationRules` (SUPER_ADMIN, RESTO_MANAGER) |
| PUT | `/api/admin/restaurants/{rid}/tables/{tableId}/location` | `TableLocation` | `TableSummary` (SUPER_ADMIN, RESTO_MANAGER) |
| GET | `/api/admin/restaurants/{rid}/feedback` | `?from=YYYY-MM-DD&to=YYYY-MM-DD&minScore=1&maxScore=10` | `FeedbackList` (SUPER_ADMIN, RESTO_MANAGER) |

`TableSummary` (`GET .../tables`) and `FloorTableView` (`GET .../floor`) gain the location
fields (`kind, floor, zone, locationDescription, seats, x, y, w, h`) so the existing admin tables
and live pages can show them.

### JSON shapes

Exact TypeScript in `frontend/src/features/reservations/types.ts` (the contract; Java records
must serialize to it). Summary:

```jsonc
// TableLocation
{ "kind": "TABLE|CABIN", "floor": 2, "zone": "Right side", "locationDescription": "2nd floor, right side, cabin 5",
  "seats": 6, "x": 10, "y": 20, "w": 12, "h": 8 }

// ReservationRules
{ "enabled": true, "bookingWindowDays": 1, "holdMinutes": 30, "defaultDurationMinutes": 120,
  "depositType": "NONE|FIXED|PERCENT", "depositValue": 0, "freeCancelHours": 2,
  "lateCancelRefundPercent": 0, "noShowRefundPercent": 0 }

// ReservationInfo
{ "restaurantId": "...", "restaurantName": "...", "currency": "AZN", "timeZone": "Asia/Baku",
  "today": "2026-11-27", "lastBookableDate": "2026-11-28", "rules": ReservationRules,
  "floors": [1, 2] }

// FloorAvailability
{ "date": "2026-11-27", "time": "19:00", "floors": [1,2],
  "tables": [ { "tableId": "...", "label": "C5", "kind": "CABIN", "floor": 2, "zone": "...",
               "locationDescription": "...", "seats": 6, "x": 10, "y": 20, "w": 12, "h": 8,
               "state": "FREE|RESERVED|OCCUPIED", "fitsParty": true,
               "reservationId": null } ] }   // reservationId only in the admin response
// state: RESERVED = an active (CONFIRMED|SEATED) reservation overlaps [time, time + defaultDuration);
//        OCCUPIED = the table has an OPEN order now and the slot starts within defaultDuration of now.

// CreateReservationRequest
{ "tableId": "...", "date": "2026-11-27", "time": "19:00", "partySize": 4, "guestName": "Aysel",
  "guestPhone": "+994501234567", "note": null, "durationMinutes": null,
  "items": [ { "menuItemId": "...", "quantity": 2 } ] }   // items optional

// ReservationView
{ "id": "...", "code": "K7Q2M9XP3A", "restaurantId": "...", "restaurantName": "...",
  "status": "CONFIRMED", "paymentStatus": "UNPAID", "source": "CUSTOMER",
  "startsAt": "2026-11-27T15:00:00Z", "endsAt": "...", "localDate": "2026-11-27", "localTime": "19:00",
  "validUntil": "2026-11-27T15:30:00Z", "partySize": 4, "guestName": "Aysel",
  "guestPhone": "+99450*****67",     // full number only in admin responses
  "note": null,
  "table": TableLocation & { "tableId": "...", "label": "C5" },
  "floorTables": [ FloorTable... ],  // same floor, for the 2D mini map (state relative to this booking)
  "items": [ { "id": "...", "menuItemId": "...", "name": "...", "quantity": 2, "unitPrice": 12.5, "totalPrice": 25.0 } ],
  "currency": "AZN", "itemsTotal": 25.0, "depositAmount": 0, "amountDue": 25.0,
  "amountToPayNow": 25.0, "paidAmount": 0, "refundedAmount": 0, "remaining": 25.0,
  "policy": { "holdMinutes": 30, "freeCancelUntil": "...", "lateCancelRefundPercent": 0,
              "noShowRefundPercent": 0, "depositType": "NONE", "depositValue": 0 },
  "canCancel": true, "canPay": true, "canEditItems": true, "seatedAt": null, "cancelledAt": null,
  "cancelReason": null, "createdAt": "..." }

// FeedbackSubmit -> FeedbackView
{ "transactionId": "...", "score": 4, "note": "Waited 30 minutes" }
{ "id": "...", "score": 4, "note": "...", "createdAt": "..." }

// FeedbackList
{ "averageScore": 8.4, "count": 37,
  "items": [ { "id": "...", "score": 9, "note": null, "tableLabel": "T3", "kind": "TABLE_BILL|RESERVATION",
               "reservationCode": null, "amountPaid": 42.5, "currency": "AZN", "createdAt": "..." } ] }
// averageScore: BigDecimal scale 1 (HALF_UP), null when count = 0. Newest first, max 500 rows.
```

Validation (`@Valid`): `guestName` 1..100 trimmed, `guestPhone` matches `^\+?[0-9 ()-]{7,20}$`,
`partySize` 1..100, `items[].quantity` 1..99, at most 50 item lines, menu items must belong to
the restaurant and be available (reuse the availability check of `CustomerOrderingService`),
feedback `score` 1..10, `note` <= 1000.

Rate limit: register the public create and feedback endpoints with the existing rate limiter
(see `masapay.rate-limit` in `application.yml`) the same way the public order endpoint is.

---

## 6. Realtime

- Staff topic: `/topic/restaurants/{restaurantId}/reservations` (already protected by
  `StompAuthInterceptor.RESTAURANT_TOPICS`). Payload
  `{ "type": "RESERVATION_CHANGED", "reservationId": "...", "localDate": "2026-11-27" }`. BACKEND
  adds `broadcastReservationChanged(restaurantId, reservationId, localDate)` next to the existing
  relay (`OrderRealtimeRelay` / `OrderRealtimeBroadcaster`; with Redis disabled it sends straight
  through `SimpMessagingTemplate`). The admin page refetches the day on any message and also polls
  every 30 s as a fallback.
- Customer pages poll: `/reservation/:code` every 20 s; the reserve floor refetches on
  date/time change and every 30 s.

## 7. Scheduler

`ReservationExpiryJob` `@Scheduled(fixedDelayString = "${masapay.reservations.expiry-interval:PT1M}")`:
`CONFIRMED` with `now > startsAt + holdMinutes` -> NO_SHOW + no-show refund. The same check runs
on every read of a single reservation (`ReservationService.refreshExpiry`). Guard with
`@ConditionalOnProperty(prefix="masapay.reservations", name="expiry-enabled", matchIfMissing=true)`
so tests can switch it off.

---

## 8. Frontend

### Routes (already wired in `frontend/src/router.tsx`)

| Route | Component (stub exists) | Owner |
|---|---|---|
| `/r/:restaurantSlug/reserve` | `ReservePage` in `src/routes/reserve-page.tsx` | CUSTOMER |
| `/reservation/:code` | `ReservationPage` in `src/routes/reservation-page.tsx` | CUSTOMER |
| `/admin/reservations` (SUPER_ADMIN, RESTO_MANAGER, WAITER) | `ReservationsPage` in `src/routes/admin/reservations-page.tsx` | ADMIN |
| `/admin/feedback` (SUPER_ADMIN, RESTO_MANAGER) | `FeedbackPage` in `src/routes/admin/feedback-page.tsx` | ADMIN |

Sidebar links already added: `nav.reservations` (CalendarClock, staff) and `nav.feedback`
(MessageSquareText, managers).

### i18n namespaces (registered in `resources.ts`; az is the typed source)

| Namespace | Files | Owner |
|---|---|---|
| `reservations` | `locales/{az,en,ru}/reservations.ts` | CUSTOMER |
| `feedback` | `locales/{az,en,ru}/feedback.ts` (rating step texts) | CUSTOMER |
| `adminReservations` | `locales/{az,en,ru}/adminReservations.ts` (staff page, table location form, rules section) | ADMIN |
| `adminFeedback` | `locales/{az,en,ru}/adminFeedback.ts` | ADMIN |

Each has a `page.title` key already; add keys to az first, then en and ru (`Messages<typeof az>`).

### CUSTOMER files

- `src/features/reservations/reservations-api.ts` - RTK `api.injectEndpoints` for all public
  endpoints above (tags `Reservation`, `ReservationFloor`).
- `src/features/reservations/floor-plan.tsx` - shared 2D floor component: absolutely positioned
  boxes on a square `0..100` grid (`left: x%`, `top: y%`, `width: w%`, `height: h%`), floor tabs,
  states FREE (white, black border), RESERVED (`#0A0A0A` fill, white text), OCCUPIED (`#F6F5F6`
  with muted text, not selectable), SELECTED / highlighted (`#08CB00`, black text); CABIN drawn
  with a thicker border and a `DoorClosed` icon; accessible as buttons with `aria-pressed` and the
  location text as `aria-label`. Props: `tables`, `selectedId?`, `highlightId?`, `onSelect?`,
  `size: 'full' | 'mini'`. ADMIN imports this component read-only (never edits it).
- `src/features/reservations/reserve-flow.tsx` + steps (`step-details.tsx`, `step-menu.tsx`,
  `step-pay.tsx`): details -> "Add dishes?" yes/no -> (menu: cards with photo left, name + price,
  black Add button, category chips, -/+ steppers, black bottom bar "N items - Order") ->
  "Pay now?" yes (checkout -> `window.location.assign(paymentUrl)`) / no (go to `/reservation/:code`).
  Codes of the guest's reservations are kept in `localStorage` key `masapay.reservations`
  (try/catch) for the QR modal.
- `src/features/reservations/reservation-details.tsx`, `reservation-arrival-modal.tsx` (shadcn
  Dialog: "You have a reservation at <table>. Your orders: ... Directions: <location>" + mini
  floor), `policy-text.tsx`, `reservation-status-badge.tsx`, `bottom-tabs.tsx` (Menu / Order /
  Reserve).
- `src/features/reservations/feedback-step.tsx` - 10 buttons `1/10 .. 10/10`, note required for
  <= 6; used on `payment-result-page.tsx` (both table bill and reservation payments).
- Edits of existing customer files allowed to CUSTOMER only: `src/routes/payment-result-page.tsx`
  (feedback step + reservation link), `src/routes/table-page.tsx` (arrival modal when a stored code
  matches this table, check-in call, "Reserve" tab link) and the customer bill item rendering in
  `src/features/order/**` (prepaid label). Keep the existing behaviour otherwise.
- `src/features/payment/payment-api.ts` `PaymentStatusView` type: CUSTOMER adds the two optional
  fields.

### ADMIN files

- `src/features/admin/reservations/reservations-admin-api.ts` - staff endpoints, rules, table
  location, feedback list.
- `src/features/admin/reservations/*` - day list, detail sheet (name, phone, time, party, items,
  paid, remaining, status + payment badges with UNPAID in clear text + amount due), create
  dialog, actions (seat / complete / cancel / no-show with confirm dialogs), STOMP subscription via
  `@/lib/stomp`, floor via `FloorPlan` from `@/features/reservations/floor-plan`.
- `src/features/admin/reservations/table-location-form.tsx` - form fields + 2D preview; mounted
  from `src/routes/admin/tables-page.tsx` / `src/features/admin/tables/table-qr-card.tsx`
  (ADMIN may edit those two files only to add the entry point).
- `src/features/admin/reservations/reservation-rules-section.tsx` - mounted in
  `src/routes/admin/settings-page.tsx` (ADMIN may add the section there).
- `src/features/admin/feedback/*` + `src/routes/admin/feedback-page.tsx` - average N/10, date and
  score filters, list rows: score N/10, note, table, time, amount paid.

---

## 9. Tests (expected minimum)

BACKEND (JUnit 5 + Mockito, style of `CustomerOrderingServiceTest`; Testcontainers tests cannot
run here without Docker - keep them compiling, run unit tests): window enforcement, overlap
rejection, amount/payment-status math (BigDecimal), refund-by-policy math, expiry to NO_SHOW,
seating attaches items and re-links transactions, feedback note rule, webhook branch for
reservation transactions.
CUSTOMER / ADMIN (Vitest + RTL, style of `routes/admin/*-page.test.tsx`): floor plan states,
flow steps (yes/no branches), feedback step note rule, admin detail actions, feedback page
average.

---

## 10. File ownership

| Builder | Owns (may create / edit) | Must not touch |
|---|---|---|
| BACKEND | `backend/**` (migrations V30-V33, `az.masapay.reservation.*`, `az.masapay.feedback.*`, changes to `RestaurantTable`, `Restaurant`, `Transaction`, `SplitType`, `PaymentCheckoutService`, `PayriffWebhookService`, `RefundService`, `PaymentStatusView`, `OpenBillWriter`, `TableSummary`, `FloorTableView`, `OrderView`/`OrderItemView`, `MenuService`, realtime relay, security/rate limit config, tests) | anything in `frontend/**`, `docs/RESERVATIONS-SPEC.md` (ask the lead) |
| CUSTOMER | `frontend/src/routes/reserve-page.tsx`, `frontend/src/routes/reservation-page.tsx`, `frontend/src/features/reservations/**` (except `types.ts`: append-only, never rename), `frontend/src/i18n/locales/{az,en,ru}/reservations.ts` and `feedback.ts`, `frontend/src/routes/payment-result-page.tsx` (+ its test), `frontend/src/routes/table-page.tsx`, `frontend/src/features/order/**`, `frontend/src/features/payment/payment-api.ts` | `backend/**`, `frontend/src/routes/admin/**`, `frontend/src/features/admin/**`, `router.tsx`, `resources.ts`, `admin-sidebar.tsx` |
| ADMIN | `frontend/src/routes/admin/reservations-page.tsx`, `frontend/src/routes/admin/feedback-page.tsx`, `frontend/src/features/admin/reservations/**`, `frontend/src/features/admin/feedback/**`, `frontend/src/i18n/locales/{az,en,ru}/adminReservations.ts` and `adminFeedback.ts`, entry points only in `frontend/src/routes/admin/tables-page.tsx`, `frontend/src/features/admin/tables/table-qr-card.tsx`, `frontend/src/features/admin/tables/tables-api.ts` (add location fields to the table type), `frontend/src/routes/admin/settings-page.tsx` | `backend/**`, customer routes, `frontend/src/features/reservations/**` (import only), `router.tsx`, `resources.ts`, `admin-sidebar.tsx` |
| LEAD (done) | `docs/RESERVATIONS-SPEC.md`, `frontend/src/router.tsx`, `frontend/src/i18n/resources.ts`, `frontend/src/features/admin/admin-sidebar.tsx`, `nav.*` keys in `locales/*/admin.ts`, `frontend/src/features/reservations/types.ts` (initial) | - |

If a builder needs a change in a file it does not own, it writes the request in its final
report instead of editing.

---

## 11. CONTRACT CHANGE 2026-11-27 (CUSTOMER builder): guest requests, allergy warnings, arrival view

Added after the owner's request "rezerv eden adam orda elave not qeyd etmek istese ... usaq ucun
masa ... alergik ... tamamile reqemsal" and "giris saatindan sonra birbasa masa ile bagli melumatlar
acilsin". Exact TypeScript in `frontend/src/features/reservations/types.ts` (appended).

### 11.1 Guest requests (fully digital notes)

```jsonc
// GuestRequests (new; on ReservationView as "requests", never null in responses)
{ "childSeats": 1,            // high chairs / child seats, 0..10
  "wheelchair": false,        // wheelchair access needed
  "occasion": "BIRTHDAY",     // "BIRTHDAY" | "ANNIVERSARY" | "BUSINESS" | null
  "allergens": ["NUTS", "GLUTEN"], // subset of the fixed list below, no duplicates
  "allergyNote": "Severe, no traces" } // free text, <= 200 chars, null when empty
// Allergen: "NUTS" | "PEANUTS" | "MILK" | "GLUTEN" | "EGGS" | "FISH" | "SHELLFISH" | "SOY" | "SESAME" | "OTHER"
```

- The existing `note` (VARCHAR(500)) stays the general free-text note (max 500 chars).
- `CreateReservationRequest` gains optional `requests: GuestRequests | null` (absent = no requests:
  0 / false / null / [] / null). Staff create accepts it too.
- `ReservationView` (public and staff) gains `requests: GuestRequests` and
  `canEditNotes: boolean` (= status CONFIRMED and now < startsAt).
- New public endpoint: `PUT /api/public/reservations/{code}/notes`, body
  `{ "note": string | null, "requests": GuestRequests }` -> `ReservationView`. Replaces both.
  `409 NOTES_LOCKED` unless `canEditNotes`. Validation `400`: childSeats 0..10, allergyNote <= 200,
  note <= 500, allergens from the fixed list. Broadcast the reservation event (section 6).
- Storage is BACKEND's choice (columns or JSON); the wire shape above is the contract.

### 11.2 Allergy warnings

- Pre-order (CUSTOMER, frontend only): a dish is flagged when its `name`, `description` or
  `ingredients` (customer menu fields) contain a keyword of a selected allergen in az/en/ru
  (`features/reservations/allergen-match.ts`). If no dish of the menu has `ingredients` data, the
  step shows a note that the restaurant has been told about the allergy instead of relying on
  matches. `OTHER` never matches automatically (the guest's `allergyNote` goes to staff).
- Staff (BACKEND/ADMIN): staff reservation views show `requests.allergens` / `allergyNote` as a
  warning; the shape used on the kitchen ticket / order view of the table is BACKEND's choice and
  must be recorded here by BACKEND.

### 11.3 Arrival view timing (customer)

`/reservation/:code` phase, computed in the browser from the server instants
(`features/reservations/arrival-phase.ts`):

- `UPCOMING`: CONFIRMED and now < startsAt -> countdown + details + notes editor.
- `ARRIVAL`: CONFIRMED and startsAt <= now < validUntil, or SEATED -> the table information view
  opens directly (table/cabin, floor, location description, directions, 2D map with the table
  highlighted, pre-ordered items, paid / remaining, notes and allergies), no extra click.
- `ENDED`: COMPLETED / CANCELLED / NO_SHOW, or CONFIRMED with now >= validUntil -> status only.

Table page after a QR scan: probes the codes stored on the phone (and an optional
`?reservation=CODE` query parameter) with `GET /api/public/tables/{qrToken}/reservation`; when one
is returned it opens the same table information view first (dialog), with the check-in button.
The table page also gets a "Reserve" link to `/r/{restaurantId}/reserve` (review finding).

### 11.4 Pay now after a partial payment (review fix)

`ReservationView.amountToPayNow` is what the "Pay now" button charges as sent by the server
(already net of `paidAmount`, capped by `remaining`). The frontend shows it as is and never
subtracts `paidAmount` again. BACKEND makes `checkoutReservation(payFull = false)` charge exactly
that amount (falls back to `remaining` once the deposit is paid).

---

## 11. CONTRACT CHANGE 2026-11-27 (added by the ADMIN builder): guest requests and allergies

**Superseded for names (ADMIN, later the same day):** the ADMIN builder removed its own
`Allergen` / `ALLERGENS` / `GuestRequests` block from `types.ts` and uses the CUSTOMER names
(`requests.allergens`, `requests.wheelchair`, `Occasion`), which the BACKEND section below also
sends. Admin screens read the staff-only extras that BACKEND sends with its names:
`FloorTable.allergies`, `KitchenLineView.allergies` / `allergyNote`,
`OrderView.reservation.allergies` / `allergyNote` / `childSeats` / `wheelchairAccess` /
`occasion` / `note`, and `refundError` on staff cancel / no-show (all declared append-only in
`types.ts` or in the admin API files). The JSON block below is kept only as history.

```jsonc
// Allergen (fixed list):
"NUTS" | "PEANUTS" | "MILK" | "GLUTEN" | "EGGS" | "FISH" | "SHELLFISH" | "SOY" | "SESAME" | "OTHER"
// ReservationOccasion:
"BIRTHDAY" | "ANNIVERSARY" | "BUSINESS" | "OTHER"

// GuestRequests
{ "childSeats": 0,            // child seats / high chairs, 0..10
  "wheelchairAccess": false,
  "occasion": null,            // ReservationOccasion | null
  "allergies": ["MILK"],       // Allergen[], distinct, may be empty
  "allergyNote": null }        // free text <= 255, null when empty
```

- `ReservationView` gains `requests: GuestRequests` (always present; defaults above) and
  `canEditRequests: boolean` (true while `status == CONFIRMED` and `now < startsAt`). The
  existing `note` (<= 500) stays the general free-text note.
- `CreateReservationRequest` gains optional `requests: GuestRequests | null` (customer and staff).
- New public endpoint `PUT /api/public/reservations/{code}/requests`, body
  `{ "requests": GuestRequests, "note": string | null }` -> `ReservationView`; only while
  `canEditRequests`, else `409 REQUESTS_LOCKED`. Broadcasts `RESERVATION_CHANGED`.
- Staff list/detail responses return the same `requests` (staff see everything).
- Kitchen: `KitchenLineView` (GET `/admin/restaurants/{rid}/kitchen`) gains
  `allergies: Allergen[]` (empty when none) and `allergyNote: string | null`, taken from the
  SEATED reservation linked to the line's order. The kitchen screen shows them as a warning on
  that table's ticket (CHEF cannot read the staff reservations API, so this is the only source
  for the chef).
- Bills: `OrderView.reservation` (`{ code, guestName, prepaidAmount }`) may gain the same
  `allergies` / `allergyNote`; until it does, the staff orders screen looks the reservation up
  by `code` in the day list it already loads (managers and waiters only).
- Admin UI (ADMIN builder): allergy warning (black box, `TriangleAlert` icon, allergen names)
  and the other requests in the reservation detail, a warning badge in the day list and an
  allergy marker on the staff floor tile (`FloorPlan` gains an optional, additive
  `renderBadge?: (table) => ReactNode` prop; customer screens never pass it).

---

## 11. CONTRACT CHANGE (BACKEND, 2026-11-27): what the server actually implements

The CUSTOMER and ADMIN sections 11 above chose different names for the same things. The backend
accepts and returns BOTH spellings, so either frontend works unchanged; the frontend builders
should still converge on one `GuestRequests` in `types.ts` (it currently declares `Allergen`,
`ALLERGENS`, `GuestRequests` twice, which does not compile).

### V34__add_reservation_guest_requests.sql

```sql
ALTER TABLE reservations
    ADD COLUMN child_seats       INTEGER      NOT NULL DEFAULT 0 CHECK (child_seats BETWEEN 0 AND 10),
    ADD COLUMN wheelchair_access BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN occasion          VARCHAR(20)  CHECK (occasion IN ('BIRTHDAY', 'ANNIVERSARY', 'BUSINESS', 'OTHER')),
    ADD COLUMN allergies         VARCHAR(200) NOT NULL DEFAULT '',   -- comma separated Allergen codes
    ADD COLUMN allergy_note      VARCHAR(255);
```

### GuestRequests on the wire

Out (every `ReservationView`, guest and staff, under `requests`, never null):

```jsonc
"requests": { "childSeats": 1, "wheelchairAccess": true, "wheelchair": true,
              "occasion": "BIRTHDAY", "allergies": ["NUTS"], "allergens": ["NUTS"],
              "allergyNote": "severe" }
```

(`wheelchair` = `wheelchairAccess`, `allergens` = `allergies`: same value twice.) In: either
spelling is accepted. Limits: `childSeats` 0..10, `allergyNote` <= 255 (the CUSTOMER UI caps at
200, which is inside), `allergies` from the fixed list, at most 10, duplicates dropped, `occasion`
`BIRTHDAY | ANNIVERSARY | BUSINESS | OTHER | null`. `400` on a value outside the limits.

- `CreateReservationRequest.requests` (optional, customer and staff), plus the existing `note`.
- `PUT /api/public/reservations/{code}/requests` and `PUT /api/public/reservations/{code}/notes`
  (same handler), body `{ "requests": GuestRequests, "note": string | null }` (both replaced; a
  missing `requests` clears them) -> `ReservationView`. Only while `status == CONFIRMED` and
  `now < startsAt`, else `409` with reason `REQUESTS_LOCKED` on `/requests` and `NOTES_LOCKED` on
  `/notes`. Broadcasts `RESERVATION_CHANGED`. Rate limited like the other guest writes.
- `ReservationView` also gains `canEditRequests` and `canEditNotes` (same value),
  `phase` (`UPCOMING | ARRIVAL | SEATED | ENDED`, the rule of 11.3 computed on the server, with
  ARRIVAL = CONFIRMED and `startsAt <= now <= validUntil`), `serverNow` (ISO instant, for the
  countdown) and per item `allergenWarnings: Allergen[]` (the guest's allergies that dish matches,
  see below).

CHANGED (`amountToPayNow`, as 11.4): already net of `paidAmount`; `checkout { payFull: false }`
charges exactly it; `payFull: true` charges `remaining`. Checkout of a CONFIRMED booking past
`validUntil` is `409 RESERVATION_STATE`.

### Allergy matching on the server

The backend matches allergens against the dish `name`, `description` and `ingredients` with az /
en / ru / tr keywords (`az.masapay.reservation.AllergenMatcher`); `OTHER` never matches. Used for
`items[].allergenWarnings` and for:

`GET /api/public/restaurants/{restaurantId}/menu/allergens?allergens=NUTS,MILK&date=YYYY-MM-DD`
-> `{ "hasAllergenData": true, "matches": [ { "menuItemId": "...", "allergens": ["NUTS"] } ] }`
(`hasAllergenData` false when no dish shown that day has `ingredients`). The frontend may use it
or keep its own matcher.

`GET /api/public/restaurants/{restaurantId}/menu` gains optional `?date=YYYY-MM-DD` (default
today, Baku): lists the dishes available on the booking day, the same check the items PUT uses
(review finding).

### Allergy on staff screens

- `ReservationView` (staff list / detail): `requests` as above.
- `FloorTable` (`GET .../reservations/floor`, staff only): `"allergies": Allergen[] | null` of the
  booking that makes the table RESERVED (null in the public response and for a free table).
- Bill `OrderView.reservation` gains `"allergies": Allergen[]`, `"allergyNote"`, `"childSeats"`,
  `"wheelchairAccess"`, `"occasion"`, `"note"` on staff endpoints and the staff topic; the
  customer channels get `allergies: []` and nulls / 0 / false.
- Live floor `FloorTableView` (`GET .../floor`): `"allergies": Allergen[] | null` from the
  reservation on the table's bill.
- Kitchen `KitchenLineView`: `"allergies": Allergen[]` (empty when none) and `"allergyNote"` from
  the SEATED or COMPLETED reservation linked to the line's order (as the ADMIN section asks).

### Arrival at the table

CHANGED: `GET /api/public/tables/{qrToken}/reservation` accepts `code` more than once
(`?code=A&code=B`, first 10 used) and returns the first one that is for this table and inside its
window (`[startsAt - 60 min, validUntil]` while CONFIRMED, or SEATED); `204` otherwise, also when
no code is given. So the table page can probe every stored code in one call.

### Other round-2 fixes

- A SEATED reservation also turns COMPLETED when its bill is CANCELLED or CLOSED (checked on
  every read and by the expiry job), not only on `OrderPaidEvent`.
- The expiry job expires each overdue booking in its own transaction, so one failing refund no
  longer keeps the others CONFIRMED.

### 11.x CUSTOMER follow-up (after reading the BACKEND section)

- The customer frontend sends and reads the CUSTOMER spelling (`requests.allergens`,
  `requests.wheelchair`) and calls `PUT /api/public/reservations/{code}/notes` (reason
  `NOTES_LOCKED`); `requestsOf()` also reads `allergies` / `wheelchairAccess` if only those come.
- `Occasion` now includes `OTHER` (as the server), shown as "Other" / "Digər" / "Другое".
- The pre-order menu is requested with `?date=<reservation localDate>`.
- The arrival phase is computed in the browser and corrected by `serverNow` (server minus device
  clock); the server `phase` field is not required by the UI.
- Pre-order warnings use the frontend matcher (`allergen-match.ts`); the server
  `menu/allergens` endpoint and `items[].allergenWarnings` are not used by the customer UI yet.
- The table page still probes stored codes one request per code (max 5, link code first); the
  multi-`code` form of the endpoint is compatible and can replace it later.
