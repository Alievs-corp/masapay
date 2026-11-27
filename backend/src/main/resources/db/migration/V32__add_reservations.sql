-- Reservations of tables and cabins with optional pre-ordered dishes and prepayment.
CREATE TABLE reservations (
    id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id               UUID          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    table_id                    UUID          NOT NULL REFERENCES tables (id) ON DELETE RESTRICT,
    code                        VARCHAR(12)   NOT NULL,
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
    deposit_type                VARCHAR(10)   NOT NULL DEFAULT 'NONE'
                                CHECK (deposit_type IN ('NONE', 'FIXED', 'PERCENT')),
    deposit_value               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_value >= 0),
    order_id                    UUID          REFERENCES orders (id) ON DELETE SET NULL,
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
CREATE INDEX idx_reservations_order           ON reservations (order_id);
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservation_items (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID          NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
    menu_item_id    UUID          REFERENCES menu_items (id) ON DELETE SET NULL,
    name            VARCHAR(255)  NOT NULL,
    quantity        INTEGER       NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price     NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservation_items_reservation ON reservation_items (reservation_id);
CREATE TRIGGER trg_reservation_items_updated_at BEFORE UPDATE ON reservation_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bill lines that came from a reservation pre-order, so the bill can label them.
ALTER TABLE order_items ADD COLUMN from_reservation BOOLEAN NOT NULL DEFAULT FALSE;

-- A reservation prepayment is a transaction without an order (yet).
ALTER TABLE transactions ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE transactions ADD COLUMN reservation_id UUID REFERENCES reservations (id) ON DELETE RESTRICT;
ALTER TABLE transactions ADD CONSTRAINT ck_transactions_target
    CHECK (order_id IS NOT NULL OR reservation_id IS NOT NULL);
-- V1 declared the split type check inline, so it carries the generated name below.
ALTER TABLE transactions DROP CONSTRAINT transactions_split_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_split_type_check
    CHECK (split_type IN ('FULL', 'ITEM', 'EQUAL', 'RESERVATION'));
CREATE INDEX idx_transactions_reservation_id ON transactions (reservation_id);
