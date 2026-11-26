package az.masapay.auth.dto;

import az.masapay.domain.User;
import az.masapay.domain.enums.UserRole;
import java.util.UUID;

/**
 * A successful sign-in: who signed in and their access token. The refresh token is never in the
 * body; it travels in the httpOnly cookie.
 */
public record LoginResponse(UUID userId, String email, String name, UserRole role, AuthTokens tokens) {

	public static LoginResponse from(User user, AuthTokens tokens) {
		return new LoginResponse(user.getId(), user.getEmail(), user.getName(), user.getRole(), tokens);
	}
}
