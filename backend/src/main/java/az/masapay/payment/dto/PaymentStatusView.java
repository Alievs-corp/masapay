package az.masapay.payment.dto;

import az.masapay.domain.Transaction;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * What the payment result page shows after Payriff sends the guest back (#37): the payment's
 * status and where the guest's table is, so the page can link back to the bill. For a reservation
 * prepayment {@code kind} is RESERVATION, {@code reservationCode} links to /reservation/:code and
 * {@code orderStatus} / {@code qrToken} are null; otherwise {@code kind} is TABLE_BILL.
 */
public record PaymentStatusView(
		UUID transactionId, String status, BigDecimal amount, String currency, String orderStatus,
		UUID restaurantId, UUID tableId, UUID qrToken, String reservationCode, String kind) {

	public static final String TABLE_BILL = "TABLE_BILL";
	public static final String RESERVATION = "RESERVATION";

	public static PaymentStatusView of(Transaction transaction) {
		var reservation = transaction.getReservation();
		if (reservation != null) {
			return new PaymentStatusView(
				transaction.getId(), transaction.getStatus().name(), transaction.getTotalAmount(),
				transaction.getCurrency(), null, transaction.getRestaurant().getId(), reservation.getTable().getId(),
				null, reservation.getCode(), RESERVATION);
		}
		var table = transaction.getOrder().getTable();
		return new PaymentStatusView(
			transaction.getId(), transaction.getStatus().name(), transaction.getTotalAmount(),
			transaction.getCurrency(), transaction.getOrder().getStatus().name(),
			transaction.getRestaurant().getId(), table.getId(), table.getQrToken(), null, TABLE_BILL);
	}
}
