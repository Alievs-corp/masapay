package az.masapay.reservation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/** Body of PUT /reservations/{code}/requests (and /notes): replaces the requests and the note. */
public record UpdateGuestRequestsRequest(@Valid GuestRequestsRequest requests, @Size(max = 500) String note) {
}
