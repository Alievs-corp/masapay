package az.masapay.reservation.dto;

import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationOccasion;
import az.masapay.reservation.Reservation;
import java.util.List;

/**
 * The special requests of a guest as every reservation response carries them (spec section 11).
 * {@code wheelchair} repeats {@code wheelchairAccess} and {@code allergens} repeats
 * {@code allergies}, so both frontend spellings read the same value.
 */
public record GuestRequestsView(int childSeats, boolean wheelchairAccess, boolean wheelchair,
		ReservationOccasion occasion, List<Allergen> allergies, List<Allergen> allergens, String allergyNote) {

	public static GuestRequestsView of(Reservation r) {
		List<Allergen> allergies = r.getAllergies() == null ? List.of() : List.copyOf(r.getAllergies());
		return new GuestRequestsView(r.getChildSeats(), r.isWheelchairAccess(), r.isWheelchairAccess(),
			r.getOccasion(), allergies, allergies, r.getAllergyNote());
	}
}
