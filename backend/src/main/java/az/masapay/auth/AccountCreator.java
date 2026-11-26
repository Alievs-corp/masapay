package az.masapay.auth;

import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import java.util.Locale;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Makes a new account the way every creator does (super admin, platform restaurants, a manager's
 * staff): lower-case email that no other account has (409 otherwise), a name, a hashed password,
 * the role and restaurant, enabled at once. Nobody signs themselves up.
 */
@Component
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AccountCreator {

	public static final String EMAIL_TAKEN = "An account with this email already exists";

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public AccountCreator(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	/** Refuses an email another account already has, in any letter case. */
	public String freeEmail(String rawEmail) {
		String email = rawEmail.trim().toLowerCase(Locale.ROOT);
		if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, EMAIL_TAKEN);
		}
		return email;
	}

	public User create(String rawEmail, String name, String password, UserRole role, Restaurant restaurant) {
		User user = new User();
		user.setEmail(freeEmail(rawEmail));
		user.setName(name == null || name.isBlank() ? null : name.trim());
		user.setPasswordHash(passwordEncoder.encode(password));
		user.setRole(role);
		user.setRestaurant(restaurant);
		user.setEnabled(true);
		return userRepository.save(user);
	}

	/** Sets a new password chosen by an admin or manager (a reset). */
	public void setPassword(User user, String password) {
		user.setPasswordHash(passwordEncoder.encode(password));
		userRepository.save(user);
	}
}
