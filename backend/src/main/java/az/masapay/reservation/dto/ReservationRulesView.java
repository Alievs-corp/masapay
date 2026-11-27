package az.masapay.reservation.dto;

import az.masapay.reservation.DepositType;
import az.masapay.reservation.ReservationRules;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** Reservation rules on the wire (GET/PUT .../reservation-rules and inside ReservationInfo). */
public record ReservationRulesView(
		boolean enabled,
		@Min(0) @Max(365) int bookingWindowDays,
		@Min(0) @Max(600) int holdMinutes,
		@Min(15) @Max(1440) int defaultDurationMinutes,
		@NotNull DepositType depositType,
		@NotNull @DecimalMin("0") @DecimalMax("9999999999.99") BigDecimal depositValue,
		@Min(0) @Max(720) int freeCancelHours,
		@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal lateCancelRefundPercent,
		@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal noShowRefundPercent) {

	public static ReservationRulesView of(ReservationRules r) {
		return new ReservationRulesView(r.isEnabled(), r.getBookingWindowDays(), r.getHoldMinutes(),
			r.getDefaultDurationMinutes(), r.getDepositType(), r.getDepositValue(), r.getFreeCancelHours(),
			r.getLateCancelRefundPercent(), r.getNoShowRefundPercent());
	}
}
