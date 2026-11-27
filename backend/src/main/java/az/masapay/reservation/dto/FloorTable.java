package az.masapay.reservation.dto;

import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.TableKind;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * One table on the reservation floor plan. {@code state} is FREE, RESERVED or OCCUPIED.
 * {@code reservationId} and {@code allergies} (of the booking that reserves it) are only filled in
 * staff responses, so the staff tile can show an allergy marker.
 */
public record FloorTable(UUID tableId, String label, TableKind kind, int floor, String zone,
		String locationDescription, int seats, BigDecimal x, BigDecimal y, BigDecimal w, BigDecimal h,
		String state, boolean fitsParty, UUID reservationId, List<Allergen> allergies) {

	public static final String FREE = "FREE";
	public static final String RESERVED = "RESERVED";
	public static final String OCCUPIED = "OCCUPIED";

	public static FloorTable of(RestaurantTable t, String state, boolean fitsParty, UUID reservationId) {
		return of(t, state, fitsParty, reservationId, null);
	}

	public static FloorTable of(RestaurantTable t, String state, boolean fitsParty, UUID reservationId,
			List<Allergen> allergies) {
		return new FloorTable(t.getId(), t.getLabel(), t.getKind(), t.getFloor(), t.getZone(),
			t.getLocationDescription(), t.getSeats(), t.getLayoutX(), t.getLayoutY(), t.getLayoutW(), t.getLayoutH(),
			state, fitsParty, reservationId, allergies);
	}
}
