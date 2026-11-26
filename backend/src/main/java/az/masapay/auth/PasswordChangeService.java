package az.masapay.auth;

import az.masapay.domain.User;
import az.masapay.repository.UserRepository;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Every signed-in user changes their own password, proving it is them with the current one. */
@Service
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PasswordChangeService {

	/** Problem detail when the current password is wrong; the admin panel shows its own text. */
	public static final String CURRENT_PASSWORD_INCORRECT = "CURRENT_PASSWORD_INCORRECT";

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public PasswordChangeService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public void changeOwn(UUID userId, String currentPassword, String newPassword) {
		User user = userRepository.findById(userId)
			.filter(User::isEnabled)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is not active"));
		if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CURRENT_PASSWORD_INCORRECT);
		}
		user.setPasswordHash(passwordEncoder.encode(newPassword));
		userRepository.save(user);
	}
}
