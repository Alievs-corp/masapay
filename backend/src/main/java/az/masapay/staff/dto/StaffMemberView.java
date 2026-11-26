package az.masapay.staff.dto;

import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import java.time.Instant;
import java.util.UUID;

/**
 * A waiter or chef as the restaurant manager sees them (#145). {@code passwordSet} is false for
 * an account made before password sign-in that has not been given a password yet.
 */
public record StaffMemberView(UUID id, String email, String name, UserRole role, Status status,
		Instant lastLoginAt, boolean passwordSet) {

	public enum Status {
		ACTIVE,
		/** Switched off by the manager or the super admin. */
		DEACTIVATED
	}

	public static StaffMemberView of(User user) {
		return new StaffMemberView(user.getId(), user.getEmail(), user.getName(), user.getRole(),
			user.isEnabled() ? Status.ACTIVE : Status.DEACTIVATED, user.getLastLoginAt(),
			user.getPasswordHash() != null);
	}
}
