-- Google sign-in is gone: accounts sign in with email and password (V28). The Google subject
-- (with its unique constraint) and the Google profile picture are no longer read or written.
ALTER TABLE users DROP COLUMN google_sub;
ALTER TABLE users DROP COLUMN picture_url;
