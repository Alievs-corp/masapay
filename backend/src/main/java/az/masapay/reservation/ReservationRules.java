package az.masapay.reservation;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Reservation rules of a restaurant (V31). {@code bookingWindowDays = 1} lets guests book today or
 * tomorrow (Baku days); staff bookings ignore the window. The refund percents and the free cancel
 * hours are copied onto each reservation when it is made.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class ReservationRules {

	@Column(name = "resv_enabled", nullable = false)
	private boolean enabled = true;

	@Column(name = "resv_booking_window_days", nullable = false)
	private int bookingWindowDays = 1;

	@Column(name = "resv_hold_minutes", nullable = false)
	private int holdMinutes = 30;

	@Column(name = "resv_default_duration_minutes", nullable = false)
	private int defaultDurationMinutes = 120;

	@Enumerated(EnumType.STRING)
	@Column(name = "resv_deposit_type", nullable = false, length = 10)
	private DepositType depositType = DepositType.NONE;

	@Column(name = "resv_deposit_value", nullable = false, precision = 12, scale = 2)
	private BigDecimal depositValue = BigDecimal.ZERO;

	@Column(name = "resv_free_cancel_hours", nullable = false)
	private int freeCancelHours = 2;

	@Column(name = "resv_late_cancel_refund_percent", nullable = false, precision = 5, scale = 2)
	private BigDecimal lateCancelRefundPercent = BigDecimal.ZERO;

	@Column(name = "resv_no_show_refund_percent", nullable = false, precision = 5, scale = 2)
	private BigDecimal noShowRefundPercent = BigDecimal.ZERO;
}
