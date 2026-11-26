package az.masapay.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * BCrypt over the SHA-256 digest of the password. BCrypt only reads the first 72 bytes of its
 * input (newer Spring Security versions refuse longer input), while a password may be up to 128
 * characters, i.e. up to 512 UTF-8 bytes. The base64 digest is always 44 ASCII characters, so
 * every character of the password counts and no length is ever refused.
 */
public final class PrehashedBCryptPasswordEncoder implements PasswordEncoder {

	private final BCryptPasswordEncoder bcrypt;

	/** @param strength BCrypt log rounds (4 to 31); 12 in production, lower only in tests. */
	public PrehashedBCryptPasswordEncoder(int strength) {
		this.bcrypt = new BCryptPasswordEncoder(strength);
	}

	@Override
	public String encode(CharSequence rawPassword) {
		return bcrypt.encode(digest(rawPassword));
	}

	@Override
	public boolean matches(CharSequence rawPassword, String encodedPassword) {
		if (rawPassword == null || encodedPassword == null || encodedPassword.isEmpty()) {
			return false;
		}
		return bcrypt.matches(digest(rawPassword), encodedPassword);
	}

	private static String digest(CharSequence rawPassword) {
		if (rawPassword == null) {
			throw new IllegalArgumentException("rawPassword cannot be null");
		}
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256")
				.digest(rawPassword.toString().getBytes(StandardCharsets.UTF_8));
			return Base64.getEncoder().encodeToString(hash);
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 is not available", e);
		}
	}
}
