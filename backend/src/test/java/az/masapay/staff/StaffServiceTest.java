package az.masapay.staff;

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
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import az.masapay.security.PrehashedBCryptPasswordEncoder;
import az.masapay.staff.dto.CreateStaffRequest;
import az.masapay.staff.dto.StaffMemberView;
import az.masapay.staff.dto.StaffMemberView.Status;
import az.masapay.staff.dto.UpdateStaffRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class StaffServiceTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
	private final PasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);
	private final StaffService service = new StaffService(userRepository, restaurantRepository,
			new AccountCreator(userRepository, encoder));

	private final Restaurant dolma = new Restaurant();
	private final Restaurant other = new Restaurant();
	private final AuthenticatedUser manager =
			new AuthenticatedUser(UUID.randomUUID(), "m@dolma.az", UserRole.RESTO_MANAGER);
	private final AuthenticatedUser otherManager =
			new AuthenticatedUser(UUID.randomUUID(), "m@other.az", UserRole.RESTO_MANAGER);
	private final AuthenticatedUser superAdmin =
			new AuthenticatedUser(UUID.randomUUID(), "admin@masapay.az", UserRole.SUPER_ADMIN);
	private final AuthenticatedUser waiterCaller =
			new AuthenticatedUser(UUID.randomUUID(), "w@dolma.az", UserRole.WAITER);

	@BeforeEach
	void setUp() {
		dolma.setId(UUID.randomUUID());
		other.setId(UUID.randomUUID());
		User managerUser = new User();
		managerUser.setRestaurant(dolma);
		when(userRepository.findById(manager.id())).thenReturn(Optional.of(managerUser));
		User otherManagerUser = new User();
		otherManagerUser.setRestaurant(other);
		when(userRepository.findById(otherManager.id())).thenReturn(Optional.of(otherManagerUser));
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

	private User member(Restaurant restaurant, UserRole role) {
		User user = new User();
		user.setId(UUID.randomUUID());
		user.setEmail(UUID.randomUUID() + "@x.az");
		user.setRestaurant(restaurant);
		user.setRole(role);
		user.setEnabled(true);
		user.setPasswordHash(encoder.encode("old-password-1"));
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		return user;
	}

	private void assertStatus(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status) {
		assertThatThrownBy(call).isInstanceOfSatisfying(ResponseStatusException.class,
				e -> assertThat(e.getStatusCode()).isEqualTo(status));
	}

	@Test
	void aManagerSeesOnlyTheirWaitersAndChefs() {
		User waiter = member(dolma, UserRole.WAITER);
		when(userRepository.findByRestaurantIdAndRoleInOrderByNameAscEmailAsc(dolma.getId(), StaffService.STAFF_ROLES))
				.thenReturn(List.of(waiter));

		assertThat(service.list(dolma.getId(), manager)).extracting(StaffMemberView::id)
				.containsExactly(waiter.getId());
		assertStatus(() -> service.list(other.getId(), manager), HttpStatus.FORBIDDEN);
		assertStatus(() -> service.list(dolma.getId(), waiterCaller), HttpStatus.FORBIDDEN);
	}

	@Test
	void aManagerCreatesAChefWhoCanSignInAtOnce() {
		StaffMemberView created = service.create(dolma.getId(),
				new CreateStaffRequest("  Aysel@Gmail.com ", "Aysel", "chef-password-1", UserRole.CHEF), manager);

		assertThat(created.email()).isEqualTo("aysel@gmail.com");
		assertThat(created.name()).isEqualTo("Aysel");
		assertThat(created.role()).isEqualTo(UserRole.CHEF);
		assertThat(created.status()).isEqualTo(Status.ACTIVE);
		assertThat(created.passwordSet()).isTrue();
	}

	@Test
	void aTakenEmailIs409() {
		when(userRepository.findByEmailIgnoreCase("taken@x.az")).thenReturn(Optional.of(new User()));

		assertStatus(() -> service.create(dolma.getId(),
				new CreateStaffRequest("taken@x.az", "T", "waiter-password", UserRole.WAITER), manager),
				HttpStatus.CONFLICT);
		verify(userRepository, never()).save(any());
	}

	@Test
	void aManagerCannotCreateManagersOrAdminsNorStaffElsewhere() {
		assertStatus(() -> service.create(dolma.getId(),
				new CreateStaffRequest("boss@x.az", "B", "manager-pass-1", UserRole.RESTO_MANAGER), manager),
				HttpStatus.BAD_REQUEST);
		assertStatus(() -> service.create(dolma.getId(),
				new CreateStaffRequest("root@x.az", "R", "admin-pass-123", UserRole.SUPER_ADMIN), manager),
				HttpStatus.BAD_REQUEST);
		assertStatus(() -> service.create(dolma.getId(),
				new CreateStaffRequest("w@x.az", "W", "waiter-password", UserRole.WAITER), otherManager),
				HttpStatus.FORBIDDEN);
		assertStatus(() -> service.create(dolma.getId(),
				new CreateStaffRequest("w@x.az", "W", "waiter-password", UserRole.WAITER), waiterCaller),
				HttpStatus.FORBIDDEN);
		verify(userRepository, never()).save(any());

		User waiter = member(dolma, UserRole.WAITER);
		assertStatus(() -> service.update(dolma.getId(), waiter.getId(),
				new UpdateStaffRequest(UserRole.SUPER_ADMIN, null), manager), HttpStatus.BAD_REQUEST);
		assertThat(waiter.getRole()).isEqualTo(UserRole.WAITER);
	}

	@Test
	void aSuperAdminMayCreateStaffForAnyRestaurant() {
		StaffMemberView created = service.create(dolma.getId(),
				new CreateStaffRequest("w@x.az", "W", "waiter-password", UserRole.WAITER), superAdmin);

		assertThat(created.status()).isEqualTo(Status.ACTIVE);
	}

	@Test
	void switchRoleSwitchOffAndBackOn() {
		User waiter = member(dolma, UserRole.WAITER);

		StaffMemberView chef = service.update(dolma.getId(), waiter.getId(),
				new UpdateStaffRequest(UserRole.CHEF, null), manager);
		assertThat(chef.role()).isEqualTo(UserRole.CHEF);

		StaffMemberView off = service.update(dolma.getId(), waiter.getId(), new UpdateStaffRequest(null, false),
				manager);
		assertThat(off.status()).isEqualTo(Status.DEACTIVATED);
		assertThat(waiter.isEnabled()).isFalse();
		assertThat(waiter.getDeactivatedAt()).isNotNull();

		StaffMemberView on = service.update(dolma.getId(), waiter.getId(), new UpdateStaffRequest(null, true),
				manager);
		assertThat(on.status()).isEqualTo(Status.ACTIVE);
		assertThat(waiter.getDeactivatedAt()).isNull();
	}

	@Test
	void aManagerSetsANewPasswordForTheirStaff() {
		User chef = member(dolma, UserRole.CHEF);

		service.resetPassword(dolma.getId(), chef.getId(), "brand-new-pass", manager);

		assertThat(encoder.matches("brand-new-pass", chef.getPasswordHash())).isTrue();
	}

	@Test
	void otherRestaurantsStaffOtherManagersAndAdminsAreOutOfReach() {
		User elsewhere = member(other, UserRole.CHEF);
		User colleague = member(dolma, UserRole.RESTO_MANAGER);
		User admin = member(null, UserRole.SUPER_ADMIN);
		String colleagueHash = colleague.getPasswordHash();

		assertStatus(() -> service.update(dolma.getId(), elsewhere.getId(), new UpdateStaffRequest(null, false),
				manager), HttpStatus.NOT_FOUND);
		assertStatus(() -> service.update(dolma.getId(), colleague.getId(), new UpdateStaffRequest(null, false),
				manager), HttpStatus.NOT_FOUND);
		assertStatus(() -> service.resetPassword(dolma.getId(), colleague.getId(), "taken-over-pass", manager),
				HttpStatus.NOT_FOUND);
		assertStatus(() -> service.resetPassword(dolma.getId(), admin.getId(), "taken-over-pass", manager),
				HttpStatus.NOT_FOUND);
		assertStatus(() -> service.resetPassword(dolma.getId(), elsewhere.getId(), "taken-over-pass", manager),
				HttpStatus.NOT_FOUND);
		// Through the other restaurant's address the manager is not that restaurant's manager.
		assertStatus(() -> service.resetPassword(other.getId(), elsewhere.getId(), "taken-over-pass", manager),
				HttpStatus.FORBIDDEN);
		assertThat(colleague.getPasswordHash()).isEqualTo(colleagueHash);
		verify(userRepository, never()).save(elsewhere);
		verify(userRepository, never()).save(colleague);
		verify(userRepository, never()).save(admin);
	}
}
