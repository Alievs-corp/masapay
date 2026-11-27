package az.masapay.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** One pre-ordered dish. */
public record ReservationItemRequest(@NotNull UUID menuItemId, @NotNull @Min(1) @Max(99) Integer quantity) {
}
