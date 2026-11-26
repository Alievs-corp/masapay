package az.masapay.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.auth.AccountCreator;
import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.PosType;
import az.masapay.domain.enums.SubscriptionPlan;
import az.masapay.domain.enums.SubscriptionStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.platform.dto.AddManagerRequest;
import az.masapay.platform.dto.CreateRestaurantRequest;
import az.masapay.platform.dto.PlatformRestaurantView;
import az.masapay.platform.dto.SubscriptionRequest;
import az.masapay.platform.dto.UpdateRestaurantRequest;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PlatformRestaurantServiceTest {

	private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
	private final UserRepository userRepository = mock(UserRepository.class);
	private final PrehashedBCryptPasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final PlatformRestaurantService service = new PlatformRestaurantService(restaurantRepository,
			userRepository, new AccountCreator(userRepository, encoder),
			Clock.fixed(Instant.parse("2026-10-23T08:00:00Z"), ZoneOffset.UTC));

	private final AuthenticatedUser superAdmin =
			new AuthenticatedUser(UUID.randomUUID(), "admin@masapay.az", UserRole.SUPER_ADMIN);
	private final AuthenticatedUser manager =
			new AuthenticatedUser(UUID.randomUUID(), "m@dolma.az", UserRole.RESTO_MANAGER);
	private final List<User> savedUsers = new ArrayList<>();

	@BeforeEach
	void setUp() {
		when(restaurantRepository.save(any(Restaurant.class))).thenAnswer(inv -> {
			Restaurant restaurant = inv.getArgument(0);
			if (restaurant.getId() == null) {
				restaurant.setId(UUID.randomUUID());
			}
			return restaurant;
		});
		when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
		when(userRepository.save(any(User.class))).thenAnswer(inv -> {
			savedUsers.add(inv.getArgument(0));
			return inv.getArgument(0);
		});
		when(userRepository.findByRestaurantIdAndRoleInOrderByNameAscEmailAsc(any(), any()))
				.thenAnswer(inv -> savedUsers.stream()
					.filter(u -> u.getRestaurant() != null && u.getRestaurant().getId().equals(inv.getArgument(0)))
					.toList());
	}

	private void assertStatus(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status) {
		assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class,
				e -> assertThat(e.getStatusCode()).isEqualTo(status));
	}

	private static CreateRestaurantRequest restaurant(String name, PosType pos, String managerEmail) {
		return new CreateRestaurantRequest(name, "AZN", pos, "Leyla", managerEmail, "manager-pass-1");
	}

	@Test
	void aNewRestaurantComesWithItsFirstManagerReadyToSignIn() {
		PlatformRestaurantView created = service.create(restaurant("  Nərgiz Kafe ", PosType.IIKO,
				"Leyla@Gmail.com "), superAdmin);

		assertThat(created.name()).isEqualTo("Nərgiz Kafe");
		assertThat(created.posType()).isEqualTo(PosType.IIKO);
		assertThat(created.active()).isTrue();
		assertThat(created.managers()).singleElement().satisfies(m -> {
			assertThat(m.email()).isEqualTo("leyla@gmail.com");
			assertThat(m.name()).isEqualTo("Leyla");
			assertThat(m.enabled()).isTrue();
			assertThat(m.lastLoginAt()).isNull();
		});
		User leyla = savedUsers.get(0);
		assertThat(leyla.getRole()).isEqualTo(UserRole.RESTO_MANAGER);
		assertThat(leyla.isEnabled()).isTrue();
		assertThat(leyla.getRestaurant().getId()).isEqualTo(created.id());
		assertThat(encoder.matches("manager-pass-1", leyla.getPasswordHash())).isTrue();
	}

	@Test
	void aTakenEmailIsRefusedAndNoRestaurantIsMade() {
		User busy = new User();
		busy.setEmail("busy@gmail.com");
		when(userRepository.findByEmailIgnoreCase("busy@gmail.com")).thenReturn(Optional.of(busy));

		assertStatus(() -> service.create(restaurant("X", PosType.CUSTOM, "Busy@gmail.com"), superAdmin),
				HttpStatus.CONFLICT);
		verify(restaurantRepository, never()).save(any());
		verify(userRepository, never()).save(any());
	}

	@Test
	void aRestaurantIsRenamedAndSwitchedOff() {
		Restaurant dolma = new Restaurant();
		dolma.setId(UUID.randomUUID());
		dolma.setName("Dolma");
		when(restaurantRepository.findById(dolma.getId())).thenReturn(Optional.of(dolma));

		PlatformRestaurantView off = service.update(dolma.getId(), new UpdateRestaurantRequest("Dolma Restoran", false),
				superAdmin);

		assertThat(off.name()).isEqualTo("Dolma Restoran");
		assertThat(off.active()).isFalse();
		assertStatus(() -> service.update(dolma.getId(), new UpdateRestaurantRequest("  ", null), superAdmin),
				HttpStatus.BAD_REQUEST);
	}

	@Test
	void aSecondManagerCanBeAdded() {
		Restaurant dolma = new Restaurant();
		dolma.setId(UUID.randomUUID());
		when(restaurantRepository.findById(dolma.getId())).thenReturn(Optional.of(dolma));
		PlatformRestaurantView view = service.addManager(dolma.getId(),
				new AddManagerRequest("Second", "Second@gmail.com", "second-pass-1"), superAdmin);

		assertThat(view.managers()).extracting(PlatformRestaurantView.Manager::email)
				.containsExactly("second@gmail.com");
		assertThat(encoder.matches("second-pass-1", savedUsers.get(0).getPasswordHash())).isTrue();
		assertStatus(() -> service.addManager(dolma.getId(),
				new AddManagerRequest("Second", "second@gmail.com", "second-pass-1"), manager), HttpStatus.FORBIDDEN);
	}

	@Test
	void aSubscriptionIsSetAndShowsWhereItStandsToday() {
		Restaurant dolma = new Restaurant();
		dolma.setId(UUID.randomUUID());
		when(restaurantRepository.findById(dolma.getId())).thenReturn(Optional.of(dolma));
		assertThat(service.setSubscription(dolma.getId(), new SubscriptionRequest(SubscriptionPlan.PRO, false,
				LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 22), new BigDecimal("49.00")), superAdmin)
			.subscription().status()).isEqualTo(SubscriptionStatus.EXPIRED);

		PlatformRestaurantView extended = service.setSubscription(dolma.getId(), new SubscriptionRequest(
				SubscriptionPlan.PRO, false, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 11, 30),
				new BigDecimal("49.00")), superAdmin);

		assertThat(extended.subscription().status()).isEqualTo(SubscriptionStatus.ACTIVE);
		assertThat(extended.subscription().endsOn()).isEqualTo(LocalDate.of(2026, 11, 30));
		assertThat(dolma.getSubscriptionMonthlyFee()).isEqualByComparingTo("49.00");
	}

	@Test
	void aSubscriptionThatEndsBeforeItStartsIsRefused() {
		Restaurant dolma = new Restaurant();
		dolma.setId(UUID.randomUUID());
		when(restaurantRepository.findById(dolma.getId())).thenReturn(Optional.of(dolma));
		SubscriptionRequest backwards = new SubscriptionRequest(SubscriptionPlan.BASIC, true,
				LocalDate.of(2026, 11, 1), LocalDate.of(2026, 10, 31), BigDecimal.ZERO);

		assertStatus(() -> service.setSubscription(dolma.getId(), backwards, superAdmin), HttpStatus.BAD_REQUEST);
		assertStatus(() -> service.setSubscription(dolma.getId(), backwards, manager), HttpStatus.FORBIDDEN);
		verify(restaurantRepository, never()).save(any());
	}

	@Test
	void onlyTheSuperAdmin() {
		assertStatus(() -> service.list(manager), HttpStatus.FORBIDDEN);
		assertStatus(() -> service.create(restaurant("X", PosType.CUSTOM, "x@x.az"), manager),
				HttpStatus.FORBIDDEN);
		ArgumentCaptor<Restaurant> any = ArgumentCaptor.forClass(Restaurant.class);
		verify(restaurantRepository, never()).save(any.capture());
	}
}
