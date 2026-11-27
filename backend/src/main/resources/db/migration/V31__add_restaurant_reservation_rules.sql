-- Reservation rules of a restaurant, edited in the admin settings.
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
