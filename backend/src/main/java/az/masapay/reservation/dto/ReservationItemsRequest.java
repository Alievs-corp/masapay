package az.masapay.reservation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Replaces the pre-ordered dishes of a reservation. */
public record ReservationItemsRequest(@NotNull @Valid @Size(max = 50) List<ReservationItemRequest> items) {
}
