-- Guest rating of the service after a successful payment (table bill or reservation prepay).
-- One row per payment; a score of 6 or lower must carry a note.
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
