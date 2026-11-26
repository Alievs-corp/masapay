package az.masapay.admin;

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
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The super admin runs every account on the platform: creates them with any role, switches them
 * on or off, changes role, restaurant or name, and sets a new password. A super admin cannot
 * switch off or demote their own account, so the platform never loses its last way in.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class UserAdminService {

	static final String NEEDS_RESTAURANT = "This role needs a restaurant";
	static final String SUPER_ADMIN_HAS_NO_RESTAURANT = "A super admin belongs to no restaurant";
	static final String OWN_ACCOUNT = "You cannot switch off or demote your own account";

	private final UserRepository userRepository;
	private final RestaurantRepository restaurantRepository;
	private final AccountCreator accounts;

	public UserAdminService(UserRepository userRepository, RestaurantRepository restaurantRepository,
			AccountCreator accounts) {
		this.userRepository = userRepository;
		this.restaurantRepository = restaurantRepository;
		this.accounts = accounts;
	}

	@Transactional(readOnly = true)
	public List<UserSummary> listUsers() {
		return userRepository.findAll(Sort.by("email")).stream().map(UserSummary::from).toList();
	}

	@Transactional
	public UserSummary createUser(CreateUserRequest request) {
		Restaurant restaurant = restaurantFor(request.role(), request.restaurantId(), null);
		return UserSummary.from(accounts.create(request.email(), request.name(), request.password(), request.role(),
			restaurant));
	}

	@Transactional
	public UserSummary updateUser(UUID userId, UpdateUserRequest request, AuthenticatedUser caller) {
		User user = find(userId);
		boolean self = user.getId().equals(caller.id());
		boolean switchesOff = Boolean.FALSE.equals(request.enabled());
		boolean demotes = request.role() != null && request.role() != UserRole.SUPER_ADMIN;
		if (self && (switchesOff || demotes)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, OWN_ACCOUNT);
		}

		if (request.name() != null) {
			if (request.name().isBlank()) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The name cannot be blank");
			}
			user.setName(request.name().trim());
		}
		if (request.role() != null || request.restaurantId() != null) {
			UserRole role = request.role() != null ? request.role() : user.getRole();
			user.setRestaurant(restaurantFor(role, request.restaurantId(), user.getRestaurant()));
			user.setRole(role);
		}
		if (request.enabled() != null) {
			user.setEnabled(request.enabled());
			user.setDeactivatedAt(request.enabled() ? null : Instant.now());
		}
		return UserSummary.from(userRepository.save(user));
	}

	@Transactional
	public void resetPassword(UUID userId, String newPassword) {
		accounts.setPassword(find(userId), newPassword);
	}

	/**
	 * The restaurant an account of this role ends up in: none for a super admin, the given one
	 * (else the current one) for everyone else, who must have one.
	 */
	private Restaurant restaurantFor(UserRole role, UUID restaurantId, Restaurant current) {
		if (role == UserRole.SUPER_ADMIN) {
			if (restaurantId != null) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, SUPER_ADMIN_HAS_NO_RESTAURANT);
			}
			return null;
		}
		if (restaurantId != null) {
			return restaurantRepository.findById(restaurantId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
		}
		if (current == null && role != null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NEEDS_RESTAURANT);
		}
		return current;
	}

	private User find(UUID userId) {
		return userRepository.findById(userId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
	}
}
