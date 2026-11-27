package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import az.masapay.domain.enums.ReservationPaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ReservationMathTest {

	private static BigDecimal d(String value) {
		return new BigDecimal(value);
	}

	@Test
	void depositIsFixedOrAPercentOfThePreOrderRoundedHalfUp() {
		assertThat(ReservationMath.deposit(DepositType.NONE, d("10"), d("50.00"))).isEqualByComparingTo("0");
		assertThat(ReservationMath.deposit(DepositType.FIXED, d("20"), d("0"))).isEqualByComparingTo("20.00");
		// 33.33 * 15 % = 4.9995 -> 5.00
		assertThat(ReservationMath.deposit(DepositType.PERCENT, d("15"), d("33.33"))).isEqualByComparingTo("5.00");
	}

	@Test
	void amountDueToPayNowAndRemaining() {
		assertThat(ReservationMath.amountDue(d("25.00"), d("10.00"))).isEqualByComparingTo("25.00");
		assertThat(ReservationMath.amountDue(d("0"), d("20.00"))).isEqualByComparingTo("20.00");
		assertThat(ReservationMath.amountToPayNow(d("25.00"), d("10.00"))).isEqualByComparingTo("10.00");
		assertThat(ReservationMath.amountToPayNow(d("25.00"), d("0"))).isEqualByComparingTo("25.00");
		assertThat(ReservationMath.remaining(d("25.00"), d("10.00"))).isEqualByComparingTo("15.00");
		assertThat(ReservationMath.remaining(d("25.00"), d("30.00"))).isEqualByComparingTo("0");
	}

	@Test
	void paymentStatusFollowsWhatIsPaid() {
		assertThat(ReservationMath.paymentStatus(d("25.00"), d("0"))).isEqualTo(ReservationPaymentStatus.UNPAID);
		assertThat(ReservationMath.paymentStatus(d("25.00"), d("10.00")))
			.isEqualTo(ReservationPaymentStatus.PARTIALLY_PAID);
		assertThat(ReservationMath.paymentStatus(d("25.00"), d("25.00"))).isEqualTo(ReservationPaymentStatus.PAID);
		assertThat(ReservationMath.paymentStatus(d("0"), d("0"))).isEqualTo(ReservationPaymentStatus.PAID);
	}

	@Test
	void cancelRefundsEverythingBeforeTheDeadlineAndTheLatePercentAfter() {
		Reservation r = new Reservation();
		r.setPaidAmount(d("40.00"));
		r.setRefundedAmount(BigDecimal.ZERO);
		r.setFreeCancelUntil(Instant.parse("2026-11-27T13:00:00Z"));
		r.setLateCancelRefundPercent(d("25"));
		r.setNoShowRefundPercent(d("10"));

		assertThat(ReservationMath.cancelRefund(r, Instant.parse("2026-11-27T12:59:00Z"), false))
			.isEqualByComparingTo("40.00");
		assertThat(ReservationMath.cancelRefund(r, Instant.parse("2026-11-27T13:30:00Z"), false))
			.isEqualByComparingTo("10.00");
		assertThat(ReservationMath.cancelRefund(r, Instant.parse("2026-11-27T13:30:00Z"), true))
			.isEqualByComparingTo("40.00");
		assertThat(ReservationMath.noShowRefund(r)).isEqualByComparingTo("4.00");
	}

	@Test
	void recomputeTakesItemsDepositAndPaidIntoAccount() {
		Reservation r = new Reservation();
		r.setDepositType(DepositType.PERCENT);
		r.setDepositValue(d("50"));
		ReservationItem item = new ReservationItem();
		item.setTotalPrice(d("30.00"));
		r.getItems().add(item);
		r.setPaidAmount(d("15.00"));

		ReservationMath.recompute(r);

		assertThat(r.getItemsTotal()).isEqualByComparingTo("30.00");
		assertThat(r.getDepositAmount()).isEqualByComparingTo("15.00");
		assertThat(r.getPaymentStatus()).isEqualTo(ReservationPaymentStatus.PARTIALLY_PAID);
	}
}
