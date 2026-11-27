package az.masapay.reservation.dto;

import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.TableKind;
import java.math.BigDecimal;
import java.util.UUID;

/** The booked table with its location, flat like the frontend ReservationTable. */
public record ReservationTableView(UUID tableId, String label, TableKind kind, int floor, String zone,
		String locationDescription, int seats, BigDecimal x, BigDecimal y, BigDecimal w, BigDecimal h) {

	public static ReservationTableView of(RestaurantTable t) {
		return new ReservationTableView(t.getId(), t.getLabel(), t.getKind(), t.getFloor(), t.getZone(),
			t.getLocationDescription(), t.getSeats(), t.getLayoutX(), t.getLayoutY(), t.getLayoutW(), t.getLayoutH());
	}
}
