package az.masapay.reservation.dto;

import java.util.List;
import java.util.UUID;

/** What the reserve page needs first: rules, today and the last bookable day (Baku), the floors. */
public record ReservationInfo(UUID restaurantId, String restaurantName, String currency, String timeZone,
		String today, String lastBookableDate, ReservationRulesView rules, List<Integer> floors) {
}
