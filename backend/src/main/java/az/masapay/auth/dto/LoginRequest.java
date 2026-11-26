package az.masapay.auth.dto;

import az.masapay.auth.ValidPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Email and password sign-in. Only the upper length of the password is checked here: whether it
 * is right is answered with the same 401 as a wrong email.
 */
public record LoginRequest(
		@NotBlank @Size(max = 320) String email,
		@NotBlank @Size(max = ValidPassword.MAX_LENGTH) String password) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "LoginRequest[email=" + email + "]";
	}
}
