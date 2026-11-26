package az.masapay.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.UserRepository;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class AccountCreatorTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final PasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final AccountCreator creator = new AccountCreator(userRepository, encoder);

	@Test
	void aNewAccountIsEnabledWithALowerCaseEmailAndAHashedPassword() {
		when(userRepository.findByEmailIgnoreCase("aysel@dolma.az")).thenReturn(Optional.empty());
		when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
		Restaurant dolma = new Restaurant();

		User user = creator.create(" Aysel@Dolma.az ", " Aysel ", "waiter-pass-1", UserRole.WAITER, dolma);

		assertThat(user.getEmail()).isEqualTo("aysel@dolma.az");
		assertThat(user.getName()).isEqualTo("Aysel");
		assertThat(user.isEnabled()).isTrue();
		assertThat(user.getRole()).isEqualTo(UserRole.WAITER);
		assertThat(user.getRestaurant()).isSameAs(dolma);
		assertThat(user.getPasswordHash()).isNotEqualTo("waiter-pass-1");
		assertThat(encoder.matches("waiter-pass-1", user.getPasswordHash())).isTrue();
	}

	@Test
	void anEmailThatIsTakenIs409() {
		when(userRepository.findByEmailIgnoreCase("aysel@dolma.az")).thenReturn(Optional.of(new User()));

		assertThatThrownBy(() -> creator.create("AYSEL@dolma.az", "A", "waiter-pass-1", UserRole.CHEF, null))
				.isInstanceOfSatisfying(ResponseStatusException.class,
						e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
		verify(userRepository, never()).save(any());
	}
}
