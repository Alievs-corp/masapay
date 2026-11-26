package az.masapay.platform.dto;

import az.masapay.domain.Restaurant;
import az.masapay.domain.User;
import az.masapay.domain.enums.PosType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** A restaurant as the super admin sees it (#147), with its managers and subscription (#148). */
public record PlatformRestaurantView(UUID id, String name, String currency, PosType posType, boolean active,
		Instant createdAt, List<Manager> managers, SubscriptionView subscription) {

	/** {@code enabled} false: the account is switched off; {@code lastLoginAt} null: never signed in. */
	public record Manager(UUID id, String email, String name, boolean enabled, Instant lastLoginAt) {

		public static Manager of(User user) {
			return new Manager(user.getId(), user.getEmail(), user.getName(), user.isEnabled(),
				user.getLastLoginAt());
		}
	}

	public static PlatformRestaurantView of(Restaurant restaurant, List<User> managers, LocalDate today) {
		return new PlatformRestaurantView(restaurant.getId(), restaurant.getName(), restaurant.getCurrency(),
			restaurant.getPosType(), restaurant.isActive(), restaurant.getCreatedAt(),
			managers.stream().map(Manager::of).toList(), SubscriptionView.of(restaurant, today));
	}
}
