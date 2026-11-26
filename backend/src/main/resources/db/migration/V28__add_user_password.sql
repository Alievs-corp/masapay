-- Email and password sign-in replaces Google sign-in. A super admin or a restaurant manager
-- creates each account with a password; only its BCrypt hash is stored. Null until a password
-- is set (accounts made before this change).
ALTER TABLE users ADD COLUMN password_hash VARCHAR(100);

-- One account per email whatever the letter case: sign-in looks the email up case-insensitively.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
