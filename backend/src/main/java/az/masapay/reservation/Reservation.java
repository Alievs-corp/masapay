package az.masapay.reservation;

import az.masapay.domain.BaseEntity;
import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.User;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationOccasion;
import az.masapay.domain.enums.ReservationPaymentStatus;
import az.masapay.domain.enums.ReservationSource;
import az.masapay.domain.enums.ReservationStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A booking of a table or cabin (V32). The policy columns are a snapshot of the restaurant rules
 * taken at booking time, so a later rule edit never changes an existing booking. {@code code} is
 * the public access key of /reservation/:code.
 */
@Entity
@Table(name = "reservations")
@Getter
@Setter
@NoArgsConstructor
public class Reservation extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "restaurant_id", nullable = false)
	private Restaurant restaurant;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "table_id", nullable = false)
	private RestaurantTable table;

	@Column(nullable = false, length = 12, updatable = false)
	private String code;

	@Column(name = "guest_name", nullable = false, length = 100)
	private String guestName;

	@Column(name = "guest_phone", nullable = false, length = 30)
	private String guestPhone;

	@Column(name = "party_size", nullable = false)
	private int partySize;

	@Column(name = "starts_at", nullable = false)
	private Instant startsAt;

	@Column(name = "ends_at", nullable = false)
	private Instant endsAt;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ReservationStatus status = ReservationStatus.CONFIRMED;

	@Enumerated(EnumType.STRING)
	@Column(name = "payment_status", nullable = false, length = 20)
	private ReservationPaymentStatus paymentStatus = ReservationPaymentStatus.UNPAID;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private ReservationSource source = ReservationSource.CUSTOMER;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "created_by")
	private User createdBy;

	@Column(length = 500)
	private String note;

	/** Child seats / high chairs the guests need (V34), 0..10. */
	@Column(name = "child_seats", nullable = false)
	private int childSeats;

	@Column(name = "wheelchair_access", nullable = false)
	private boolean wheelchairAccess;

	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private ReservationOccasion occasion;

	/** The guest's allergies from the fixed list; shown to staff and the kitchen as a warning. */
	@Convert(converter = AllergenListConverter.class)
	@Column(nullable = false, length = 200)
	private List<Allergen> allergies = new ArrayList<>();

	@Column(name = "allergy_note", length = 255)
	private String allergyNote;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(nullable = false, length = 3)
	private String currency = "AZN";

	@Column(name = "items_total", nullable = false, precision = 12, scale = 2)
	private BigDecimal itemsTotal = BigDecimal.ZERO;

	@Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal depositAmount = BigDecimal.ZERO;

	@Column(name = "paid_amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal paidAmount = BigDecimal.ZERO;

	@Column(name = "refunded_amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal refundedAmount = BigDecimal.ZERO;

	@Column(name = "hold_minutes", nullable = false)
	private int holdMinutes;

	@Column(name = "free_cancel_until", nullable = false)
	private Instant freeCancelUntil;

	@Column(name = "late_cancel_refund_percent", nullable = false, precision = 5, scale = 2)
	private BigDecimal lateCancelRefundPercent = BigDecimal.ZERO;

	@Column(name = "no_show_refund_percent", nullable = false, precision = 5, scale = 2)
	private BigDecimal noShowRefundPercent = BigDecimal.ZERO;

	@Enumerated(EnumType.STRING)
	@Column(name = "deposit_type", nullable = false, length = 10)
	private DepositType depositType = DepositType.NONE;

	@Column(name = "deposit_value", nullable = false, precision = 12, scale = 2)
	private BigDecimal depositValue = BigDecimal.ZERO;

	/** The table bill the reservation joined when it was seated. */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "order_id")
	private Order order;

	@Column(name = "seated_at")
	private Instant seatedAt;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancel_reason", length = 255)
	private String cancelReason;

	@OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("createdAt ASC")
	private List<ReservationItem> items = new ArrayList<>();

	/** Until when an unseated booking holds the table. */
	public Instant validUntil() {
		return startsAt.plusSeconds(holdMinutes * 60L);
	}
}
