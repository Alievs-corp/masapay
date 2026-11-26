package az.masapay.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.admin.dto.CreateUserRequest;
import az.masapay.admin.dto.UpdateUserRequest;
import az.masapay.admin.dto.UserSummary;
import az.masapay.auth.AccountCreator;
import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class UserAdminServiceTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
	private final PasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final UserAdminService service = new UserAdminService(userRepository, restaurantRepository,
			new AccountCreator(userRepository, encoder));

	private final AuthenticatedUser me = new AuthenticatedUser(UUID.randomUUID(), "admin@masapay.az",
			UserRole.SUPER_ADMIN);
	private final Restaurant dolma = new Restaurant();

	@BeforeEach
	void setUp() {
		dolma.setId(UUID.randomUUID());
		when(restaurantRepository.findById(dolma.getId())).thenReturn(Optional.of(dolma));
		when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
		when(userRepository.save(any(User.class))).thenAnswer(inv -> {
			User user = inv.getArgument(0);
			if (user.getId() == null) {
				user.setId(UUID.randomUUID());
			}
			return user;
		});
	}

	private User account(UUID id, UserRole role, Restaurant restaurant) {
		User user = new User();
		user.setId(id);
		user.setEmail(id + "@masapay.az");
		user.setRole(role);
		user.setRestaurant(restaurant);
		user.setEnabled(true);
		user.setPasswordHash(encoder.encode("old-password-1"));
		when(userRepository.findById(id)).thenReturn(Optional.of(user));
		return user;
	}

	private void assertStatus(ThrowingCallable call, HttpStatus status) {
		assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class,
				e -> assertThat(e.getStatusCode()).isEqualTo(status));
	}

	@Test
	void theListIsSortedByEmailAndNeverCarriesTheHash() {
		User waiter = account(UUID.randomUUID(), UserRole.WAITER, dolma);
		when(userRepository.findAll(Sort.by("email"))).thenReturn(List.of(waiter));

		List<UserSummary> summaries = service.listUsers();

		assertThat(summaries).singleElement().satisfies(s -> {
			assertThat(s.passwordSet()).isTrue();
			assertThat(s.restaurantId()).isEqualTo(dolma.getId());
			assertThat(s.toString()).doesNotContain("$2a$");
		});
	}

	@Test
	void aManagerIsCreatedEnabledWithAHashedPassword() {
		UserSummary created = service.createUser(new CreateUserRequest(" Leyla@Gmail.com ", " Leyla ",
				"manager-pass-1", UserRole.RESTO_MANAGER, dolma.getId()));

		assertThat(created.email()).isEqualTo("leyla@gmail.com");
		assertThat(created.name()).isEqualTo("Leyla");
		assertThat(created.enabled()).isTrue();
		assertThat(created.passwordSet()).isTrue();
		assertThat(created.restaurantId()).isEqualTo(dolma.getId());
	}

	@Test
	void aSuperAdminIsCreatedWithoutARestaurant() {
		UserSummary created = service.createUser(new CreateUserRequest("second@masapay.az", "Second",
				"admin-pass-123", UserRole.SUPER_ADMIN, null));

		assertThat(created.role()).isEqualTo(UserRole.SUPER_ADMIN);
		assertThat(created.restaurantId()).isNull();
	}

	@Test
	void theRestaurantMustMatchTheRole() {
		assertStatus(() -> service.createUser(new CreateUserRequest("w@x.az", "W", "waiter-pass-1",
				UserRole.WAITER, null)), HttpStatus.BAD_REQUEST);
		assertStatus(() -> service.createUser(new CreateUserRequest("a@x.az", "A", "admin-pass-12",
				UserRole.SUPER_ADMIN, dolma.getId())), HttpStatus.BAD_REQUEST);
		assertStatus(() -> service.createUser(new CreateUserRequest("c@x.az", "C", "chef-pass-123",
				UserRole.CHEF, UUID.randomUUID())), HttpStatus.NOT_FOUND);
		verify(userRepository, never()).save(any());
	}

	@Test
	void anEmailThatIsTakenInAnyCaseIs409() {
		when(userRepository.findByEmailIgnoreCase("taken@masapay.az")).thenReturn(Optional.of(new User()));

		assertStatus(() -> service.createUser(new CreateUserRequest("Taken@Masapay.az", "T", "taken-pass-1",
				UserRole.CHEF, dolma.getId())), HttpStatus.CONFLICT);
		verify(userRepository, never()).save(any());
	}

	@Test
	void anAccountIsSwitchedOffMovedAndRenamed() {
		Restaurant other = new Restaurant();
		other.setId(UUID.randomUUID());
		when(restaurantRepository.findById(other.getId())).thenReturn(Optional.of(other));
		User waiter = account(UUID.randomUUID(), UserRole.WAITER, dolma);

		UserSummary result = service.updateUser(waiter.getId(),
				new UpdateUserRequest(false, UserRole.RESTO_MANAGER, other.getId(), " Murad "), me);

		assertThat(result.enabled()).isFalse();
		assertThat(waiter.getDeactivatedAt()).isNotNull();
		assertThat(result.role()).isEqualTo(UserRole.RESTO_MANAGER);
		assertThat(result.restaurantId()).isEqualTo(other.getId());
		assertThat(result.name()).isEqualTo("Murad");
	}

	@Test
	void promotingToSuperAdminDropsTheRestaurant() {
		User manager = account(UUID.randomUUID(), UserRole.RESTO_MANAGER, dolma);

		UserSummary result = service.updateUser(manager.getId(),
				new UpdateUserRequest(null, UserRole.SUPER_ADMIN, null, null), me);

		assertThat(result.role()).isEqualTo(UserRole.SUPER_ADMIN);
		assertThat(result.restaurantId()).isNull();
	}

	@Test
	void aRoleThatNeedsARestaurantCannotBeGivenWithoutOne() {
		User admin = account(UUID.randomUUID(), UserRole.SUPER_ADMIN, null);

		assertStatus(() -> service.updateUser(admin.getId(), new UpdateUserRequest(null, UserRole.WAITER, null,
				null), me), HttpStatus.BAD_REQUEST);
		assertThat(admin.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
	}

	@Test
	void aSuperAdminCannotSwitchOffOrDemoteThemselves() {
		User self = account(me.id(), UserRole.SUPER_ADMIN, null);

		assertStatus(() -> service.updateUser(me.id(), new UpdateUserRequest(false, null, null, null), me),
				HttpStatus.CONFLICT);
		assertStatus(() -> service.updateUser(me.id(), new UpdateUserRequest(null, UserRole.RESTO_MANAGER,
				dolma.getId(), null), me), HttpStatus.CONFLICT);
		assertThat(self.isEnabled()).isTrue();
		assertThat(self.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
		verify(userRepository, never()).save(any());

		// Renaming oneself is fine.
		assertThat(service.updateUser(me.id(), new UpdateUserRequest(true, UserRole.SUPER_ADMIN, null, "Owner"),
				me).name()).isEqualTo("Owner");
	}

	@Test
	void aBlankNameIsRefused() {
		User waiter = account(UUID.randomUUID(), UserRole.WAITER, dolma);

		assertStatus(() -> service.updateUser(waiter.getId(), new UpdateUserRequest(null, null, null, "  "), me),
				HttpStatus.BAD_REQUEST);
	}

	@Test
	void anyPasswordCanBeReset() {
		User chef = account(UUID.randomUUID(), UserRole.CHEF, dolma);

		service.resetPassword(chef.getId(), "brand-new-pass");

		assertThat(encoder.matches("brand-new-pass", chef.getPasswordHash())).isTrue();
		assertStatus(() -> service.resetPassword(UUID.randomUUID(), "brand-new-pass"), HttpStatus.NOT_FOUND);
	}

	@Test
	void unknownUsersAndRestaurantsAreNotFound() {
		User waiter = account(UUID.randomUUID(), UserRole.WAITER, dolma);

		assertStatus(() -> service.updateUser(UUID.randomUUID(), new UpdateUserRequest(true, null, null, null), me),
				HttpStatus.NOT_FOUND);
		assertStatus(() -> service.updateUser(waiter.getId(), new UpdateUserRequest(null, null, UUID.randomUUID(),
				null), me), HttpStatus.NOT_FOUND);
	}
}
