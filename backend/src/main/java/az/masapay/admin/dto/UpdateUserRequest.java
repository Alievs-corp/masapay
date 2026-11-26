package az.masapay.admin.dto;

import az.masapay.domain.enums.UserRole;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Partial update of an account by the super admin. Null fields are left unchanged, so one call
 * can switch an account on, give it a role and restaurant, or rename it.
 */
public record UpdateUserRequest(Boolean enabled, UserRole role, UUID restaurantId, @Size(max = 255) String name) {
}
