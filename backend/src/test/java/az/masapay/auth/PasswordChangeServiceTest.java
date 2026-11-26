package az.masapay.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class PasswordChangeServiceTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final PasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final PasswordChangeService service = new PasswordChangeService(userRepository, encoder);

	private User account(boolean enabled) {
		User user = new User();
		user.setId(UUID.randomUUID());
		user.setEmail("waiter@dolma.az");
		user.setRole(UserRole.WAITER);
		user.setEnabled(enabled);
		user.setPasswordHash(encoder.encode("old-password-1"));
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		return user;
	}

	private void assertStatus(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status,
			String reason) {
		assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
			assertThat(e.getStatusCode()).isEqualTo(status);
			assertThat(e.getReason()).isEqualTo(reason);
		});
	}

	@Test
	void theRightCurrentPasswordSetsTheNewOne() {
		User user = account(true);

		service.changeOwn(user.getId(), "old-password-1", "new-password-2");

		assertThat(encoder.matches("new-password-2", user.getPasswordHash())).isTrue();
		assertThat(encoder.matches("old-password-1", user.getPasswordHash())).isFalse();
		verify(userRepository).save(user);
	}

	@Test
	void aWrongCurrentPasswordChangesNothing() {
		User user = account(true);
		String before = user.getPasswordHash();

		assertStatus(() -> service.changeOwn(user.getId(), "not-the-password", "new-password-2"),
				HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INCORRECT");
		assertThat(user.getPasswordHash()).isEqualTo(before);
		verify(userRepository, never()).save(any());
	}

	@Test
	void aSwitchedOffAccountCannotChangeIt() {
		User user = account(false);

		assertStatus(() -> service.changeOwn(user.getId(), "old-password-1", "new-password-2"),
				HttpStatus.FORBIDDEN, "Account is not active");
	}
}
