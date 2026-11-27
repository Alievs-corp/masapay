package az.masapay.reservation.dto;

import java.util.UUID;

/** Sent to /topic/restaurants/{restaurantId}/reservations when a booking changes. */
public record ReservationChangedMessage(String type, UUID reservationId, String localDate) {

	public static ReservationChangedMessage of(UUID reservationId, String localDate) {
		return new ReservationChangedMessage("RESERVATION_CHANGED", reservationId, localDate);
	}
}
