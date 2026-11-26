package az.masapay.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

class SuperAdminBootstrapTest {

	private static final String PASSWORD = "bootstrap-password-123";

	private final UserRepository userRepository = mock(UserRepository.class);
	private final PasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final List<User> saved = new ArrayList<>();

	@BeforeEach
	void setUp() {
		when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
		when(userRepository.save(any(User.class))).thenAnswer(inv -> {
			saved.add(inv.getArgument(0));
			return inv.getArgument(0);
		});
	}

	private void run(String emails, String password) {
		new SuperAdminBootstrap(userRepository, encoder, emails, password).run(new DefaultApplicationArguments());
	}

	@Test
	void anUnknownEmailBecomesAnEnabledSuperAdminWithThePassword() {
		run(" Owner@Masapay.az , second@masapay.az,", PASSWORD);

		assertThat(saved).extracting(User::getEmail).containsExactly("owner@masapay.az", "second@masapay.az");
		assertThat(saved).allSatisfy(user -> {
			assertThat(user.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
			assertThat(user.isEnabled()).isTrue();
			assertThat(encoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
		});
	}

	@Test
	void anExistingAccountWithoutAPasswordGetsItAndBecomesSuperAdmin() {
		User legacy = new User();
		legacy.setEmail("owner@masapay.az");
		legacy.setRole(UserRole.WAITER);
		legacy.setRestaurant(new Restaurant());
		legacy.setDeactivatedAt(Instant.now());
		when(userRepository.findByEmailIgnoreCase("owner@masapay.az")).thenReturn(Optional.of(legacy));

		run("owner@masapay.az", PASSWORD);

		assertThat(saved).containsExactly(legacy);
		assertThat(legacy.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
		assertThat(legacy.getRestaurant()).isNull();
		assertThat(legacy.isEnabled()).isTrue();
		assertThat(legacy.getDeactivatedAt()).isNull();
		assertThat(encoder.matches(PASSWORD, legacy.getPasswordHash())).isTrue();
	}

	@Test
	void aPasswordThatIsAlreadySetIsNeverOverwritten() {
		User admin = new User();
		admin.setEmail("owner@masapay.az");
		admin.setRole(UserRole.SUPER_ADMIN);
		admin.setEnabled(true);
		admin.setPasswordHash(encoder.encode("changed-in-the-panel"));
		String before = admin.getPasswordHash();
		when(userRepository.findByEmailIgnoreCase("owner@masapay.az")).thenReturn(Optional.of(admin));

		run("owner@masapay.az", PASSWORD);

		assertThat(admin.getPasswordHash()).isEqualTo(before);
		verify(userRepository, never()).save(any());
	}

	@Test
	void withoutAPasswordNothingIsCreated() {
		run("owner@masapay.az", "  ");

		verify(userRepository, never()).findByEmailIgnoreCase(anyString());
		verify(userRepository, never()).save(any());
	}

	@Test
	void aPasswordOutsideThePolicyIsNotUsed() {
		run("owner@masapay.az", "short");

		verify(userRepository, never()).save(any());
	}

	@Test
	void withoutEmailsNothingHappens() {
		run("", PASSWORD);

		verifyNoInteractions(userRepository);
	}
}
