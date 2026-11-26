package az.masapay.staff.dto;

import az.masapay.domain.enums.UserRole;

/**
 * Change a staff member (#145): {@code role} WAITER or CHEF, {@code active} true switches the
 * account on, false switches it off. Null fields stay as they are.
 */
public record UpdateStaffRequest(UserRole role, Boolean active) {
}
