package az.masapay.reservation.dto;

/** {@code payFull} pays the whole amount due instead of just the deposit. */
public record ReservationCheckoutRequest(Boolean payFull) {
}
