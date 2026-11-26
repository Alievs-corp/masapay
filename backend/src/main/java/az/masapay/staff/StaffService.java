package az.masapay.staff;

import az.masapay.auth.AccountCreator;
import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import az.masapay.staff.dto.CreateStaffRequest;
import az.masapay.staff.dto.StaffMemberView;
import az.masapay.staff.dto.UpdateStaffRequest;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * A restaurant manager runs their own waiters and chefs (#145): creates an account with an email,
 * a name and a password (it works at once), moves it between waiter and chef, switches it off or
 * on, and sets a new password. A manager only ever sees and changes WAITER and CHEF accounts of
 * their own restaurant: other managers, super admins and other restaurants' staff are out of
 * reach. A super admin may do the same for any restaurant.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class StaffService {

	/** The roles a manager may give. */
	static final Set<UserRole> STAFF_ROLES = Set.of(UserRole.WAITER, UserRole.CHEF);

	private final UserRepository userRepository;
	private final RestaurantRepository restaurantRepository;
	private final AccountCreator accounts;

	public StaffService(UserRepository userRepository, RestaurantRepository restaurantRepository,
			AccountCreator accounts) {
		this.userRepository = userRepository;
		this.restaurantRepository = restaurantRepository;
		this.accounts = accounts;
	}

	@Transactional(readOnly = true)
	public List<StaffMemberView> list(UUID restaurantId, AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		return userRepository.findByRestaurantIdAndRoleInOrderByNameAscEmailAsc(restaurantId, STAFF_ROLES).stream()
			.map(StaffMemberView::of)
			.toList();
	}

	/** A new waiter or chef of this restaurant, enabled at once; a taken email is 409. */
	@Transactional
	public StaffMemberView create(UUID restaurantId, CreateStaffRequest request, AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		checkStaffRole(request.role());
		Restaurant restaurant = restaurantRepository.findById(restaurantId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
		return StaffMemberView.of(accounts.create(request.email(), request.name(), request.password(),
			request.role(), restaurant));
	}

	/** Switches a staff member on or off, or moves them between waiter and chef. */
	@Transactional
	public StaffMemberView update(UUID restaurantId, UUID userId, UpdateStaffRequest request,
			AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		User user = member(restaurantId, userId);
		if (request.role() != null) {
			checkStaffRole(request.role());
			user.setRole(request.role());
		}
		if (Boolean.TRUE.equals(request.active())) {
			user.setEnabled(true);
			user.setDeactivatedAt(null);
		} else if (Boolean.FALSE.equals(request.active())) {
			user.setEnabled(false);
			user.setDeactivatedAt(Instant.now());
		}
		return StaffMemberView.of(userRepository.save(user));
	}

	/** Sets a new password for a waiter or chef, e.g. one who forgot theirs. */
	@Transactional
	public void resetPassword(UUID restaurantId, UUID userId, String newPassword, AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		accounts.setPassword(member(restaurantId, userId), newPassword);
	}

	/** A waiter or chef of this restaurant; anyone else is "not found". */
	private User member(UUID restaurantId, UUID userId) {
		return userRepository.findById(userId)
			.filter(member -> member.getRestaurant() != null && member.getRestaurant().getId().equals(restaurantId))
			.filter(member -> STAFF_ROLES.contains(member.getRole()))
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found"));
	}

	private static void checkStaffRole(UserRole role) {
		if (!STAFF_ROLES.contains(role)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A manager can give WAITER or CHEF only");
		}
	}

	/** Only the restaurant's own manager, or a super admin. */
	private void checkManager(AuthenticatedUser caller, UUID restaurantId) {
		if (caller.role() == UserRole.SUPER_ADMIN) {
			return;
		}
		if (caller.role() != UserRole.RESTO_MANAGER) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Managers only");
		}
		User manager = userRepository.findById(caller.id())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
		if (manager.getRestaurant() == null || !manager.getRestaurant().getId().equals(restaurantId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your restaurant");
		}
	}
}
