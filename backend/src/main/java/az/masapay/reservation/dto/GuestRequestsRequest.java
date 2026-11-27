package az.masapay.reservation.dto;

import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationOccasion;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * The special requests of a guest as a screen sends them (spec section 11). Both spellings the
 * frontend builders chose are accepted: {@code wheelchairAccess} or {@code wheelchair}, and
 * {@code allergies} or {@code allergens}. Every field is optional (0, false, none).
 */
public record GuestRequestsRequest(
		@Min(0) @Max(10) Integer childSeats,
		@JsonAlias("wheelchair") Boolean wheelchairAccess,
		ReservationOccasion occasion,
		@JsonAlias("allergens") @Size(max = 10) List<Allergen> allergies,
		@Size(max = 255) String allergyNote) {
}
