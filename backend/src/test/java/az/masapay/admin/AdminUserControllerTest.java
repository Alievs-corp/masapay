package az.masapay.admin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.masapay.admin.dto.UserSummary;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** The accounts API over HTTP: super admin only, validated bodies, no password hash in answers. */
@WebMvcTest(AdminUserController.class)
@Import({SecurityConfig.class, JwtService.class})
class AdminUserControllerTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private UserAdminService service;

	private static Authentication as(UserRole role) {
		AuthenticatedUser principal = new AuthenticatedUser(UUID.randomUUID(), "user@masapay.az", role);
		return new UsernamePasswordAuthenticationToken(principal, null,
			List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
	}

	@Test
	void managersCannotReachTheAccounts() throws Exception {
		mvc.perform(get("/api/admin/users").with(authentication(as(UserRole.RESTO_MANAGER))))
			.andExpect(status().isForbidden());
		mvc.perform(post("/api/admin/users").with(authentication(as(UserRole.RESTO_MANAGER)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"x@x.az\",\"name\":\"X\",\"password\":\"long-enough-1\",\"role\":\"WAITER\"}"))
			.andExpect(status().isForbidden());
		verifyNoInteractions(service);
	}

	@Test
	void theSuperAdminCreatesAnAccount() throws Exception {
		when(service.createUser(any())).thenReturn(new UserSummary(UUID.randomUUID(), "x@x.az", "X",
			UserRole.SUPER_ADMIN, true, null, null, true));

		mvc.perform(post("/api/admin/users").with(authentication(as(UserRole.SUPER_ADMIN)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"x@x.az\",\"name\":\"X\",\"password\":\"long-enough-1\","
					+ "\"role\":\"SUPER_ADMIN\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.passwordSet").value(true))
			.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void aShortPasswordIs400() throws Exception {
		mvc.perform(post("/api/admin/users").with(authentication(as(UserRole.SUPER_ADMIN)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"x@x.az\",\"name\":\"X\",\"password\":\"short\",\"role\":\"WAITER\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("password: must be 10 to 128 characters"));
		mvc.perform(put("/api/admin/users/{id}/password", UUID.randomUUID())
				.with(authentication(as(UserRole.SUPER_ADMIN)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"short\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("newPassword: must be 10 to 128 characters"));
		verifyNoInteractions(service);
	}

	@Test
	void aPasswordResetIs204() throws Exception {
		UUID id = UUID.randomUUID();
		mvc.perform(put("/api/admin/users/{id}/password", id).with(authentication(as(UserRole.SUPER_ADMIN)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"brand-new-pass\"}"))
			.andExpect(status().isNoContent());
		verify(service).resetPassword(id, "brand-new-pass");
	}
}
