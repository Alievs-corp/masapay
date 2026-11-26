package az.masapay.staff.dto;

import az.masapay.auth.ValidPassword;
import az.masapay.domain.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A new waiter or chef account, made by the restaurant's manager with a password (#145). */
public record CreateStaffRequest(
		@NotBlank @Email @Size(max = 320) String email,
		@NotBlank @Size(max = 255) String name,
		@ValidPassword String password,
		@NotNull UserRole role) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "CreateStaffRequest[email=" + email + ", role=" + role + "]";
	}
}
