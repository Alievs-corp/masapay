package az.masapay.reservation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The reservation code a guest checks in with at the table. */
public record CheckInRequest(@NotBlank @Size(max = 12) String code) {
}
