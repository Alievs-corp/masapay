package az.masapay.auth;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.masapay.config.SecurityConfig;
import az.masapay.domain.enums.UserRole;
import az.masapay.security.AuthenticatedUser;
import az.masapay.security.JwtService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** The sign-in endpoints over HTTP: public, validated, and refusals as 401 problem details. */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtService.class, RefreshTokenCookie.class})
class AuthWebTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private PasswordLoginService loginService;
	@MockitoBean
	private PasswordChangeService passwordChangeService;
	@MockitoBean
	private TokenService tokenService;

	private static final AuthenticatedUser CHEF =
		new AuthenticatedUser(UUID.randomUUID(), "chef@dolma.az", UserRole.CHEF);

	private static UsernamePasswordAuthenticationToken signedIn(AuthenticatedUser user) {
		return new UsernamePasswordAuthenticationToken(user, null,
			List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name())));
	}

	@Test
	void aWrongPasswordIsAGeneric401() throws Exception {
		when(loginService.authenticate(anyString(), anyString()))
			.thenThrow(new BadCredentialsException(PasswordLoginService.INVALID_CREDENTIALS));

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"ali@masapay.az\",\"password\":\"wrong-password\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value("Invalid email or password"));
	}

	@Test
	void aMissingFieldIs400NamingTheField() throws Exception {
		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"ali@masapay.az\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("password: must not be blank"));
	}

	@Test
	void changingThePasswordNeedsASession() throws Exception {
		mvc.perform(post("/api/auth/password").contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"new-password-2\"}"))
			.andExpect(status().isUnauthorized());
		verifyNoInteractions(passwordChangeService);
	}

	@Test
	void anySignedInRoleChangesItsOwnPassword() throws Exception {
		mvc.perform(post("/api/auth/password").with(authentication(signedIn(CHEF)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"new-password-2\"}"))
			.andExpect(status().isNoContent());
		verify(passwordChangeService).changeOwn(CHEF.id(), "old-password-1", "new-password-2");
	}

	@Test
	void aTooShortNewPasswordIs400WithThePolicy() throws Exception {
		mvc.perform(post("/api/auth/password").with(authentication(signedIn(CHEF)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"short\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("newPassword: must be 10 to 128 characters"));
		verifyNoInteractions(passwordChangeService);
	}

	@Test
	void aTooLongNewPasswordIs400Too() throws Exception {
		String tooLong = "x".repeat(129);
		mvc.perform(post("/api/auth/password").with(authentication(signedIn(CHEF)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"" + tooLong + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("newPassword: must be 10 to 128 characters"));
	}
}
