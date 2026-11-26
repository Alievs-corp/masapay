package az.masapay.domain;

import az.masapay.domain.enums.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An account of the admin panel. It signs in with its email and password; nobody signs up: a
 * super admin or a restaurant manager creates it.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User extends BaseEntity {

	@Column(nullable = false, length = 320)
	private String email;

	@Column(length = 255)
	private String name;

	/** BCrypt hash of the password; null until one is set. Never leaves the backend. */
	@Column(name = "password_hash", length = 100)
	private String passwordHash;

	/** Null until an admin provisions the user (EPIC 3, #16). */
	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private UserRole role;

	/** Restaurant the staff member belongs to; null for unassigned/super admins. */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "restaurant_id")
	private Restaurant restaurant;

	/** Only an enabled account can sign in; switching it off ends its sessions at the next refresh. */
	@Column(nullable = false)
	private boolean enabled = false;

	@Column(name = "last_login_at")
	private Instant lastLoginAt;

	/** When a manager switched the account off (#145); null while active or still waiting. */
	@Column(name = "deactivated_at")
	private Instant deactivatedAt;
}
