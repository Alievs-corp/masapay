package az.masapay.auth;

import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the first super admin, who then creates every other account. At each startup, every
 * email in {@code MASAPAY_SUPER_ADMIN_EMAILS} gets an enabled SUPER_ADMIN account with the
 * password in {@code MASAPAY_SUPER_ADMIN_PASSWORD}: a new account when the email is unknown, or
 * an existing account that has no password yet. An account that already has a password is never
 * touched, so a password changed in the admin panel survives restarts. The password is never
 * logged.
 */
@Component
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SuperAdminBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrap.class);

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final List<String> emails;
	private final String password;

	public SuperAdminBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder,
			@Value("${masapay.auth.super-admin-emails:}") String emails,
			@Value("${masapay.auth.super-admin-password:}") String password) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.emails = Arrays.stream(emails.split(","))
			.map(email -> email.trim().toLowerCase(Locale.ROOT))
			.filter(email -> !email.isEmpty())
			.distinct()
			.toList();
		this.password = password == null ? "" : password;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (emails.isEmpty()) {
			return;
		}
		if (password.isBlank()) {
			log.warn("MASAPAY_SUPER_ADMIN_EMAILS is set but MASAPAY_SUPER_ADMIN_PASSWORD is empty:"
				+ " no super admin account was created or given a password.");
			return;
		}
		if (password.length() < ValidPassword.MIN_LENGTH || password.length() > ValidPassword.MAX_LENGTH) {
			log.warn("MASAPAY_SUPER_ADMIN_PASSWORD must be {} to {} characters: no super admin account was"
				+ " created or given a password.", ValidPassword.MIN_LENGTH, ValidPassword.MAX_LENGTH);
			return;
		}
		emails.forEach(this::bootstrap);
	}

	private void bootstrap(String email) {
		User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
		if (user != null && user.getPasswordHash() != null) {
			log.info("Super admin bootstrap: {} already has a password; the account is left as it is.", email);
			return;
		}
		boolean created = user == null;
		if (created) {
			user = new User();
			user.setEmail(email);
		}
		user.setPasswordHash(passwordEncoder.encode(password));
		user.setRole(UserRole.SUPER_ADMIN);
		user.setRestaurant(null);
		user.setEnabled(true);
		user.setDeactivatedAt(null);
		userRepository.save(user);
		log.info(created
			? "Super admin bootstrap: created the super admin account {}."
			: "Super admin bootstrap: {} had no password; it is now an enabled super admin with the configured one.",
			email);
	}
}
