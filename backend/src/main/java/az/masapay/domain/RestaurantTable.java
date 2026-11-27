package az.masapay.domain;

import az.masapay.domain.enums.TableKind;
import az.masapay.domain.enums.TableStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A physical restaurant table. Named RestaurantTable to avoid clashing with jakarta.persistence.Table. */
@Entity
@Table(name = "tables")
@Getter
@Setter
@NoArgsConstructor
public class RestaurantTable extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "restaurant_id", nullable = false)
	private Restaurant restaurant;

	@Column(nullable = false, length = 50)
	private String label;

	/** Opaque token embedded in the table QR code; generated once on creation. */
	@Column(name = "qr_token", nullable = false, updatable = false)
	private UUID qrToken = UUID.randomUUID();

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private TableStatus status = TableStatus.AVAILABLE;

	/**
	 * This table's own service charge in percent (#146): null follows the restaurant, 0 means none
	 * at this table.
	 */
	@Column(name = "service_charge_percent", precision = 5, scale = 2)
	private BigDecimal serviceChargePercent;

	/** Open table or closed cabin (reservations). */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private TableKind kind = TableKind.TABLE;

	/** Floor the table is on; its 2D box is drawn on that floor's plan. */
	@Column(nullable = false)
	private int floor = 1;

	/** Short zone or side label, e.g. "Right side". */
	@Column(length = 50)
	private String zone;

	/** Free-text directions for guests, e.g. "2nd floor, right side, cabin 5". */
	@Column(name = "location_description", length = 255)
	private String locationDescription;

	@Column(nullable = false)
	private int seats = 4;

	/** Box on the floor's 0-100 grid. */
	@Column(name = "layout_x", nullable = false, precision = 5, scale = 2)
	private BigDecimal layoutX = BigDecimal.ZERO;

	@Column(name = "layout_y", nullable = false, precision = 5, scale = 2)
	private BigDecimal layoutY = BigDecimal.ZERO;

	@Column(name = "layout_w", nullable = false, precision = 5, scale = 2)
	private BigDecimal layoutW = BigDecimal.TEN;

	@Column(name = "layout_h", nullable = false, precision = 5, scale = 2)
	private BigDecimal layoutH = BigDecimal.TEN;

	/**
	 * The service charge that applies at this table: its own percentage when it has one (0 meaning
	 * none), otherwise the restaurant's. Null when nothing is charged.
	 */
	public BigDecimal effectiveServiceChargePercent() {
		BigDecimal percent = serviceChargePercent != null ? serviceChargePercent : restaurant.getServiceChargePercent();
		return percent == null || percent.signum() == 0 ? null : percent;
	}
}
