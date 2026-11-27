package az.masapay.reservation.dto;

import jakarta.validation.constraints.Size;

/** {@code fullRefund} (managers only) refunds everything regardless of the policy. */
public record CancelReservationRequest(@Size(max = 255) String reason, Boolean fullRefund) {
}
