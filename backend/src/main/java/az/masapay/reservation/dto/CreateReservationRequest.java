package az.masapay.reservation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * A new booking; date and time are in the restaurant zone (Asia/Baku). {@code note} is the general
 * free-text note and {@code requests} the special requests (child seats, allergies...), both optional.
 */
public record CreateReservationRequest(
		@NotNull UUID tableId,
		@NotNull LocalDate date,
		@NotNull @JsonFormat(pattern = "HH:mm") LocalTime time,
		@NotNull @Min(1) @Max(100) Integer partySize,
		@NotBlank @Size(max = 100) String guestName,
		@NotNull @Pattern(regexp = "^\\+?[0-9 ()-]{7,20}$") String guestPhone,
		@Size(max = 500) String note,
		@Min(15) @Max(1440) Integer durationMinutes,
		@Valid @Size(max = 50) List<ReservationItemRequest> items,
		@Valid GuestRequestsRequest requests) {

	/** A booking without special requests. */
	public CreateReservationRequest(UUID tableId, LocalDate date, LocalTime time, Integer partySize,
			String guestName, String guestPhone, String note, Integer durationMinutes,
			List<ReservationItemRequest> items) {
		this(tableId, date, time, partySize, guestName, guestPhone, note, durationMinutes, items, null);
	}
}
