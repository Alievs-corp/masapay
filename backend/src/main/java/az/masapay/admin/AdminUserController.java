package az.masapay.admin;

import az.masapay.admin.dto.CreateUserRequest;
import az.masapay.admin.dto.UpdateUserRequest;
import az.masapay.admin.dto.UserSummary;
import az.masapay.auth.dto.NewPasswordRequest;
import az.masapay.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Every account on the platform, run by the SUPER_ADMIN: list, create with a password and any
 * role, switch on or off, change role, restaurant or name, and set a new password. Anyone else
 * gets 403.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@ConditionalOnProperty(prefix = "masapay.auth", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AdminUserController {

	private final UserAdminService userAdminService;

	public AdminUserController(UserAdminService userAdminService) {
		this.userAdminService = userAdminService;
	}

	@GetMapping
	public List<UserSummary> list() {
		return userAdminService.listUsers();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public UserSummary create(@Valid @RequestBody CreateUserRequest request) {
		return userAdminService.createUser(request);
	}

	@PatchMapping("/{id}")
	public UserSummary update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return userAdminService.updateUser(id, request, caller);
	}

	@PutMapping("/{id}/password")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void resetPassword(@PathVariable UUID id, @Valid @RequestBody NewPasswordRequest request) {
		userAdminService.resetPassword(id, request.newPassword());
	}
}
