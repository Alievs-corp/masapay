package az.masapay.auth.dto;

import az.masapay.auth.ValidPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A signed-in user changes their own password: the current one proves it is them. */
public record ChangePasswordRequest(
		@NotBlank @Size(max = ValidPassword.MAX_LENGTH) String currentPassword,
		@ValidPassword String newPassword) {

	/** Never print the passwords, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "ChangePasswordRequest[]";
	}
}
