package az.masapay.reservation.dto;

import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationPaymentStatus;
import az.masapay.domain.enums.ReservationSource;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.reservation.DepositType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A reservation as the guest page and the staff page show it (spec sections 5 and 11).
 * {@code refundError} is set only on a cancel or no-show response whose policy refund Payriff did
 * not take. {@code phase} tells the guest page what to open (UPCOMING countdown, ARRIVAL or SEATED
 * table information, ENDED status); {@code serverNow} is the server time it was computed at.
 * {@code canEditNotes} repeats {@code canEditRequests} for the other frontend spelling.
 */
public record ReservationView(
		UUID id, String code, UUID restaurantId, String restaurantName,
		ReservationStatus status, ReservationPaymentStatus paymentStatus, ReservationSource source,
		Instant startsAt, Instant endsAt, String localDate, String localTime, Instant validUntil,
		int partySize, String guestName, String guestPhone, String note,
		ReservationTableView table, List<FloorTable> floorTables, List<Item> items,
		String currency, BigDecimal itemsTotal, BigDecimal depositAmount, BigDecimal amountDue,
		BigDecimal amountToPayNow, BigDecimal paidAmount, BigDecimal refundedAmount, BigDecimal remaining,
		Policy policy, boolean canCancel, boolean canPay, boolean canEditItems,
		Instant seatedAt, Instant cancelledAt, String cancelReason, Instant createdAt,
		String refundError, GuestRequestsView requests, boolean canEditRequests, boolean canEditNotes,
		String phase, Instant serverNow) {

	public static final String PHASE_UPCOMING = "UPCOMING";
	public static final String PHASE_ARRIVAL = "ARRIVAL";
	public static final String PHASE_SEATED = "SEATED";
	public static final String PHASE_ENDED = "ENDED";

	/** {@code allergenWarnings}: the guest's allergies this dish matches by name or ingredients. */
	public record Item(UUID id, UUID menuItemId, String name, int quantity, BigDecimal unitPrice,
			BigDecimal totalPrice, List<Allergen> allergenWarnings) {
	}

	public record Policy(int holdMinutes, Instant freeCancelUntil, BigDecimal lateCancelRefundPercent,
			BigDecimal noShowRefundPercent, DepositType depositType, BigDecimal depositValue) {
	}

	public ReservationView withRefundError(String error) {
		return new ReservationView(id, code, restaurantId, restaurantName, status, paymentStatus, source, startsAt,
			endsAt, localDate, localTime, validUntil, partySize, guestName, guestPhone, note, table, floorTables, items,
			currency, itemsTotal, depositAmount, amountDue, amountToPayNow, paidAmount, refundedAmount, remaining,
			policy, canCancel, canPay, canEditItems, seatedAt, cancelledAt, cancelReason, createdAt, error, requests,
			canEditRequests, canEditNotes, phase, serverNow);
	}
}
