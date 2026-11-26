package az.masapay.platform.dto;

import az.masapay.auth.ValidPassword;
import az.masapay.domain.enums.PosType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** A new restaurant on the platform and the account of its first manager (#147). */
public record CreateRestaurantRequest(
		@NotBlank @Size(max = 255) String name,
		@NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
		@NotNull PosType posType,
		@NotBlank @Size(max = 255) String managerName,
		@NotBlank @Email @Size(max = 320) String managerEmail,
		@ValidPassword String managerPassword) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "CreateRestaurantRequest[name=" + name + ", managerEmail=" + managerEmail + "]";
	}
}
