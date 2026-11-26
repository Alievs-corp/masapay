package az.masapay.auth.dto;

import az.masapay.auth.ValidPassword;

/** A new password set by a super admin or a manager for someone else's account (a reset). */
public record NewPasswordRequest(@ValidPassword String newPassword) {

	/** Never print the password, e.g. in a log line or an exception message. */
	@Override
	public String toString() {
		return "NewPasswordRequest[]";
	}
}
