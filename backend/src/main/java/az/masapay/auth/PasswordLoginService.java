package az.masapay.auth;

import az.masapay.domain.User;
import az.masapay.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Email and password sign-in. Every refusal (unknown email, wrong password, an account without a
 * password, a switched-off account or one without a role) gets the same message, and an unknown
 * email still costs one BCrypt check, so neither the answer nor its timing tells whether an
 * account exists.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PasswordLoginService {

	public static final String INVALID_CREDENTIALS = "Invalid email or password";

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final Clock clock;
	/** Compared against when there is no real hash, to keep the timing of every answer alike. */
	private final String dummyHash;

	@Autowired
	public PasswordLoginService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this(userRepository, passwordEncoder, Clock.systemUTC());
	}

	PasswordLoginService(UserRepository userRepository, PasswordEncoder passwordEncoder, Clock clock) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.clock = clock;
		this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
	}

	@Transactional
	public User authenticate(String email, String password) {
		User user = userRepository.findByEmailIgnoreCase(email.trim()).orElse(null);
		String hash = user != null ? user.getPasswordHash() : null;
		boolean matches = passwordEncoder.matches(password, hash != null ? hash : dummyHash);
		if (user == null || hash == null || !matches || !user.isEnabled() || user.getRole() == null) {
			throw new BadCredentialsException(INVALID_CREDENTIALS);
		}
		user.setLastLoginAt(Instant.now(clock));
		return userRepository.save(user);
	}
}
