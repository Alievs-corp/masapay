package az.masapay.auth;

import az.masapay.auth.dto.AuthTokens;
import az.masapay.auth.dto.ChangePasswordRequest;
import az.masapay.auth.dto.LoginRequest;
import az.masapay.auth.dto.LoginResponse;
import az.masapay.auth.dto.RefreshRequest;
import az.masapay.domain.User;
import az.masapay.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Email and password sign-in, token refresh, logout and changing one's own password. The access
 * token is returned in the body (the admin panel keeps it in memory only); the refresh token is
 * set as an httpOnly cookie and never appears in the body (#17). There is no sign-up: accounts are
 * created by a super admin or a restaurant manager.
 */
@RestController
@RequestMapping("/api/auth")
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AuthController {

	private final PasswordLoginService loginService;
	private final PasswordChangeService passwordChangeService;
	private final TokenService tokenService;
	private final RefreshTokenCookie refreshCookie;

	public AuthController(PasswordLoginService loginService, PasswordChangeService passwordChangeService,
			TokenService tokenService, RefreshTokenCookie refreshCookie) {
		this.loginService = loginService;
		this.passwordChangeService = passwordChangeService;
		this.tokenService = tokenService;
		this.refreshCookie = refreshCookie;
	}

	/**
	 * Email and password sign-in. Any refusal is the same 401 "Invalid email or password"; on
	 * success the access token is in the body and the refresh token in the httpOnly cookie.
	 */
	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
		User user = loginService.authenticate(request.email(), request.password());
		return LoginResponse.from(user, withCookie(tokenService.issueFor(user), response));
	}

	/**
	 * The signed-in user changes their own password (the only authenticated endpoint here). A
	 * wrong current password is 400 CURRENT_PASSWORD_INCORRECT.
	 */
	@PostMapping("/password")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void changePassword(@AuthenticationPrincipal AuthenticatedUser caller,
			@Valid @RequestBody ChangePasswordRequest request) {
		passwordChangeService.changeOwn(caller.id(), request.currentPassword(), request.newPassword());
	}

	/**
	 * Exchanges a valid refresh token for a new access token and a rotated refresh cookie. The
	 * token is read from the cookie; a JSON body {@code {"refreshToken": ...}} is still accepted
	 * for non-browser clients.
	 */
	@PostMapping("/refresh")
	public AuthTokens refresh(@CookieValue(name = RefreshTokenCookie.NAME, required = false) String cookieToken,
			@RequestBody(required = false) RefreshRequest request, HttpServletResponse response) {
		String refreshToken = cookieToken != null && !cookieToken.isBlank()
			? cookieToken
			: request == null ? null : request.refreshToken();
		if (refreshToken == null || refreshToken.isBlank()) {
			throw new BadCredentialsException("No refresh token");
		}
		return withCookie(tokenService.refresh(refreshToken), response);
	}

	/** Deletes the refresh cookie; the client drops its in-memory access token itself. */
	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(HttpServletResponse response) {
		response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.clear());
	}

	@ExceptionHandler(BadCredentialsException.class)
	@ResponseStatus(HttpStatus.UNAUTHORIZED)
	public ProblemDetail onBadCredentials(BadCredentialsException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
	}

	/** Moves the refresh token from the body into the httpOnly cookie. */
	private AuthTokens withCookie(AuthTokens tokens, HttpServletResponse response) {
		response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.create(tokens.refreshToken()));
		return new AuthTokens(tokens.accessToken(), null, tokens.expiresInSeconds());
	}
}
