package az.masapay.order.dto;

import az.masapay.domain.Order;
import az.masapay.domain.OrderItem;
import az.masapay.domain.User;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationOccasion;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The live order (adisyon) for a table with its line items. {@code equalSplit} is
 * null unless an equal split has been started; {@code serviceCharge} is null
 * unless the total is more than the items (e.g. a service charge). {@code waiter} is who serves the
 * table and gets its tips (#182); null when nobody has taken it, and always null for customers.
 */
public record OrderView(
		UUID orderId, String status, BigDecimal totalAmount, BigDecimal paidAmount, BigDecimal outstanding,
		Instant openedAt, List<OrderItemView> items, EqualSplitView equalSplit, ServiceChargeView serviceCharge,
		Waiter waiter, ReservationInfo reservation) {

	/**
	 * The reservation whose guests sit at this bill, with what they prepaid (null when none). The
	 * guest requests (allergies first) are for staff; customer channels get them emptied.
	 */
	public record ReservationInfo(String code, String guestName, BigDecimal prepaidAmount, List<Allergen> allergies,
			String allergyNote, int childSeats, boolean wheelchairAccess, ReservationOccasion occasion, String note) {

		/** Without guest requests. */
		public ReservationInfo(String code, String guestName, BigDecimal prepaidAmount) {
			this(code, guestName, prepaidAmount, List.of(), null, 0, false, null, null);
		}

		/** What customers at the table see: no allergies or notes of the booking guest. */
		public ReservationInfo forCustomers() {
			return new ReservationInfo(code, guestName, prepaidAmount);
		}
	}

	/** A bill without a reservation. */
	public OrderView(UUID orderId, String status, BigDecimal totalAmount, BigDecimal paidAmount,
			BigDecimal outstanding, Instant openedAt, List<OrderItemView> items, EqualSplitView equalSplit,
			ServiceChargeView serviceCharge, Waiter waiter) {
		this(orderId, status, totalAmount, paidAmount, outstanding, openedAt, items, equalSplit, serviceCharge,
			waiter, null);
	}

	/** The same bill with the reservation that joined it. */
	public OrderView withReservation(ReservationInfo info) {
		return new OrderView(orderId, status, totalAmount, paidAmount, outstanding, openedAt, items, equalSplit,
			serviceCharge, waiter, info);
	}

	/** The waiter serving the table; {@code name} falls back to the email. */
	public record Waiter(UUID id, String name) {

		static Waiter of(User user) {
			return user == null ? null
				: new Waiter(user.getId(), user.getName() != null ? user.getName() : user.getEmail());
		}
	}

	/**
	 * {@code paidAmount} is what successful payments have covered so far (tips excluded), so the
	 * receipt shows paid vs. remaining exactly, whatever mix of split modes was used.
	 */
	public static OrderView of(Order order, List<OrderItem> items, BigDecimal paidAmount) {
		List<OrderItemView> itemViews = items.stream()
			.map(OrderItemView::of)
			.toList();
		EqualSplitView equalSplit = order.getEqualSplitParts() == null
			? null
			: new EqualSplitView(order.getEqualSplitParts(), order.getEqualSplitPaidParts());
		BigDecimal extra = order.getTotalAmount()
			.subtract(items.stream().map(OrderItem::getTotalPrice).reduce(BigDecimal.ZERO, BigDecimal::add));
		ServiceChargeView serviceCharge = extra.signum() <= 0
			? null
			: new ServiceChargeView(extra, order.getServiceChargeGuests(), order.getServiceChargePaidShares());
		BigDecimal outstanding = order.getTotalAmount().subtract(paidAmount).max(BigDecimal.ZERO);
		return new OrderView(
			order.getId(), order.getStatus().name(), order.getTotalAmount(), paidAmount, outstanding,
			order.getOpenedAt(), itemViews, equalSplit, serviceCharge, Waiter.of(order.getWaiter()));
	}

	/** The same bill without staff names, for customers (#144). */
	public OrderView withoutStaffNames() {
		return new OrderView(orderId, status, totalAmount, paidAmount, outstanding, openedAt,
			items.stream().map(OrderItemView::withoutStaffName).toList(), equalSplit, serviceCharge, null,
			reservation == null ? null : reservation.forCustomers());
	}
}
