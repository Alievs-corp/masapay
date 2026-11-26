package az.masapay.admin.dto;

import az.masapay.auth.ValidPassword;
import az.masapay.domain.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * A new account made by the super admin, any role. {@code restaurantId} is required for
 * RESTO_MANAGER, WAITER and CHEF and must be null for SUPER_ADMIN.
 */
public record CreateUserRequest(
		@NotBlank @Email @Size(max = 320) String email,
		@NotBlank @Size(max = 255) String name,
		@ValidPassword String password,
		@NotNull UserRole role,
		UUID restaurantId) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "CreateUserRequest[email=" + email + ", role=" + role + ", restaurantId=" + restaurantId + "]";
	}
}
