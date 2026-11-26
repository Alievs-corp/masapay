package az.masapay.staff;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** The staff API over HTTP: managers only, and the password policy on create and reset. */
@WebMvcTest(StaffController.class)
@Import({SecurityConfig.class, JwtService.class})
class StaffControllerTest {

	private static final String URL = "/api/admin/restaurants/{restaurantId}/staff";

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private StaffService staffService;

	private static Authentication as(UserRole role) {
		AuthenticatedUser principal = new AuthenticatedUser(UUID.randomUUID(), "user@masapay.az", role);
		return new UsernamePasswordAuthenticationToken(principal, null,
			List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
	}

	@Test
	void waitersAndChefsCannotManageStaff() throws Exception {
		mvc.perform(put(URL + "/{userId}/password", UUID.randomUUID(), UUID.randomUUID())
				.with(authentication(as(UserRole.WAITER)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"brand-new-pass\"}"))
			.andExpect(status().isForbidden());
		verifyNoInteractions(staffService);
	}

	@Test
	void aShortPasswordIs400() throws Exception {
		mvc.perform(post(URL, UUID.randomUUID()).with(authentication(as(UserRole.RESTO_MANAGER)))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"w@x.az\",\"name\":\"W\",\"password\":\"short\",\"role\":\"WAITER\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("password: must be 10 to 128 characters"));
		verifyNoInteractions(staffService);
	}

	@Test
	void aManagerResetsAPassword() throws Exception {
		UUID restaurantId = UUID.randomUUID();
		UUID userId = UUID.randomUUID();
		mvc.perform(put(URL + "/{userId}/password", restaurantId, userId)
				.with(authentication(as(UserRole.RESTO_MANAGER)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"brand-new-pass\"}"))
			.andExpect(status().isNoContent());
		verify(staffService).resetPassword(eq(restaurantId), eq(userId), eq("brand-new-pass"), any());
	}
}
