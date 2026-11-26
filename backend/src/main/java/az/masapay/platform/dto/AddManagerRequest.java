package az.masapay.platform.dto;

import az.masapay.auth.ValidPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One more manager account for a restaurant, with a password (#147). */
public record AddManagerRequest(
		@NotBlank @Size(max = 255) String name,
		@NotBlank @Email @Size(max = 320) String email,
		@ValidPassword String password) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "AddManagerRequest[email=" + email + "]";
	}
}
