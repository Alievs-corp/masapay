-- Guest requests on a reservation (spec section 11): child seats / high chairs, wheelchair access,
-- the occasion, allergies (comma separated Allergen codes) with a free-text allergy note. The
-- existing note column stays the general free-text note.
ALTER TABLE reservations
    ADD COLUMN child_seats       INTEGER      NOT NULL DEFAULT 0 CHECK (child_seats BETWEEN 0 AND 10),
    ADD COLUMN wheelchair_access BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN occasion          VARCHAR(20)  CHECK (occasion IN ('BIRTHDAY', 'ANNIVERSARY', 'BUSINESS', 'OTHER')),
    ADD COLUMN allergies         VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN allergy_note      VARCHAR(255);
