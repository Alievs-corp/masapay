package az.masapay.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordLoginServiceTest {

	private static final String PASSWORD = "correct-password";
	private static final Instant NOW = Instant.parse("2026-11-26T10:00:00Z");

	private final UserRepository userRepository = mock(UserRepository.class);
	private final PasswordEncoder encoder = spy(new PrehashedBCryptPasswordEncoder(4));
	private PasswordLoginService service;

	@BeforeEach
	void setUp() {
		service = new PasswordLoginService(userRepository, encoder, Clock.fixed(NOW, ZoneOffset.UTC));
		when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
	}

	private User account(boolean enabled, String password) {
		User user = new User();
		user.setId(UUID.randomUUID());
		user.setEmail("ali@masapay.az");
		user.setRole(UserRole.RESTO_MANAGER);
		user.setEnabled(enabled);
		user.setPasswordHash(password == null ? null : encoder.encode(password));
		when(userRepository.findByEmailIgnoreCase("ali@masapay.az")).thenReturn(Optional.of(user));
		return user;
	}

	private void assertRefused(String email, String password) {
		assertThatThrownBy(() -> service.authenticate(email, password))
				.isInstanceOf(BadCredentialsException.class)
				.hasMessage("Invalid email or password");
	}

	@Test
	void theRightPasswordSignsInAndRecordsTheTime() {
		User user = account(true, PASSWORD);

		User signedIn = service.authenticate(" ali@masapay.az ", PASSWORD);

		assertThat(signedIn).isSameAs(user);
		assertThat(user.getLastLoginAt()).isEqualTo(NOW);
		verify(userRepository).save(user);
	}

	@Test
	void aWrongPasswordIsRefused() {
		account(true, PASSWORD);

		assertRefused("ali@masapay.az", "wrong-password");
		verify(userRepository, never()).save(any());
	}

	@Test
	void anUnknownEmailGetsTheSameAnswerAfterTheSameWork() {
		when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

		assertRefused("nobody@masapay.az", PASSWORD);
		// One BCrypt comparison against the dummy hash, as for a real account.
		verify(encoder, times(1)).matches(eq(PASSWORD), anyString());
	}

	@Test
	void anAccountWithoutAPasswordIsRefused() {
		account(true, null);

		assertRefused("ali@masapay.az", PASSWORD);
		verify(encoder, times(1)).matches(eq(PASSWORD), anyString());
	}

	@Test
	void aSwitchedOffAccountIsRefusedEvenWithTheRightPassword() {
		account(false, PASSWORD);

		assertRefused("ali@masapay.az", PASSWORD);
		verify(userRepository, never()).save(any());
	}

	@Test
	void anAccountWithoutARoleIsRefused() {
		User user = account(true, PASSWORD);
		user.setRole(null);

		assertRefused("ali@masapay.az", PASSWORD);
	}
}
