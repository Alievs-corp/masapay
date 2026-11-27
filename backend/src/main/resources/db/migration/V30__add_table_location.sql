-- Where a table or cabin is in the restaurant (reservations, 2D floor plan): kind, floor, zone,
-- a free-text description and a box on a 0-100 grid per floor.
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
