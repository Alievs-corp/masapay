package az.masapay.reservation;

import az.masapay.domain.enums.ReservationPaymentStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Money rules of a reservation (spec section 2), all in BigDecimal with 2 decimals, HALF_UP.
 * <ul>
 * <li>deposit: FIXED value, PERCENT of the pre-order, or 0;</li>
 * <li>amountDue = max(itemsTotal, deposit);</li>
 * <li>amountToPayNow = deposit when there is one, otherwise the pre-order;</li>
 * <li>remaining = amountDue - paid, never below 0.</li>
 * </ul>
 */
public final class ReservationMath {

	private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

	private ReservationMath() {
	}

	public static BigDecimal money(BigDecimal value) {
		return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
	}

	public static BigDecimal deposit(DepositType type, BigDecimal value, BigDecimal itemsTotal) {
		if (type == null || value == null) {
			return money(BigDecimal.ZERO);
		}
		return switch (type) {
			case NONE -> money(BigDecimal.ZERO);
			case FIXED -> money(value);
			case PERCENT -> money(itemsTotal).multiply(value).divide(HUNDRED, 2, RoundingMode.HALF_UP);
		};
	}

	public static BigDecimal amountDue(BigDecimal itemsTotal, BigDecimal deposit) {
		return money(itemsTotal).max(money(deposit));
	}

	public static BigDecimal amountToPayNow(BigDecimal itemsTotal, BigDecimal deposit) {
		return money(deposit).signum() > 0 ? money(deposit) : money(itemsTotal);
	}

	/**
	 * What the guest's "Pay now" charges (spec 11.4): the deposit part not paid yet, or what remains
	 * once the deposit is paid; never above {@code remaining}. The view and checkout both use it.
	 */
	public static BigDecimal payNow(BigDecimal itemsTotal, BigDecimal deposit, BigDecimal paid) {
		BigDecimal remaining = remaining(amountDue(itemsTotal, deposit), paid);
		BigDecimal open = amountToPayNow(itemsTotal, deposit).subtract(money(paid))
			.max(BigDecimal.ZERO.setScale(2)).min(remaining);
		return open.signum() > 0 ? open : remaining;
	}

	public static BigDecimal remaining(BigDecimal amountDue, BigDecimal paid) {
		return money(amountDue).subtract(money(paid)).max(BigDecimal.ZERO.setScale(2));
	}

	public static ReservationPaymentStatus paymentStatus(BigDecimal amountDue, BigDecimal paid) {
		BigDecimal due = money(amountDue);
		BigDecimal p = money(paid);
		if (p.compareTo(due) >= 0) {
			return ReservationPaymentStatus.PAID;
		}
		return p.signum() == 0 ? ReservationPaymentStatus.UNPAID : ReservationPaymentStatus.PARTIALLY_PAID;
	}

	/** {@code percent} of {@code amount}, 2 decimals HALF_UP. */
	public static BigDecimal percentOf(BigDecimal amount, BigDecimal percent) {
		return money(amount).multiply(percent == null ? BigDecimal.ZERO : percent)
			.divide(HUNDRED, 2, RoundingMode.HALF_UP);
	}

	/**
	 * What a cancel gives back of what is paid (net of earlier refunds): everything before the free
	 * cancel deadline, the late-cancel percent after it.
	 */
	public static BigDecimal cancelRefund(Reservation r, Instant now, boolean fullRefund) {
		BigDecimal refundable = refundable(r);
		if (fullRefund || now.isBefore(r.getFreeCancelUntil())) {
			return refundable;
		}
		return percentOf(refundable, r.getLateCancelRefundPercent());
	}

	/** What a no-show gives back: the no-show percent of what is paid. */
	public static BigDecimal noShowRefund(Reservation r) {
		return percentOf(refundable(r), r.getNoShowRefundPercent());
	}

	private static BigDecimal refundable(Reservation r) {
		return money(r.getPaidAmount()).subtract(money(r.getRefundedAmount())).max(BigDecimal.ZERO.setScale(2));
	}

	/** Recomputes deposit and payment status from the items and what is paid. */
	public static void recompute(Reservation r) {
		BigDecimal items = r.getItems().stream().map(ReservationItem::getTotalPrice)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
		r.setItemsTotal(money(items));
		r.setDepositAmount(deposit(r.getDepositType(), r.getDepositValue(), r.getItemsTotal()));
		r.setPaymentStatus(paymentStatus(amountDue(r.getItemsTotal(), r.getDepositAmount()), r.getPaidAmount()));
	}
}
