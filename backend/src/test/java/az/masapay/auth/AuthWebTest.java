package az.masapay.auth;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.masapay.config.SecurityConfig;
import az.masapay.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** The sign-in endpoints over HTTP: public, validated, and refusals as 401 problem details. */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtService.class, RefreshTokenCookie.class})
class AuthWebTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private GoogleAuthService googleAuthService;
	@MockitoBean
	private PasswordLoginService loginService;
	@MockitoBean
	private TokenService tokenService;

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
}
