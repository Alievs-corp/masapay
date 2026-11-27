package az.masapay.kitchen.dto;

import az.masapay.domain.OrderItem;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.KitchenStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One ordered dish on the kitchen screen (#142): which table, what, how many, since when.
 * {@code allergies} / {@code allergyNote} come from the reservation whose guests sit at that bill
 * (spec 11), so the chef sees them on the ticket; empty / null when none.
 */
public record KitchenLineView(UUID id, UUID tableId, String tableLabel, String name, BigDecimal quantity,
		KitchenStatus status, Instant orderedAt, List<Allergen> allergies, String allergyNote) {

	public static KitchenLineView of(OrderItem item) {
		return of(item, List.of(), null);
	}

	public static KitchenLineView of(OrderItem item, List<Allergen> allergies, String allergyNote) {
		return new KitchenLineView(item.getId(), item.getOrder().getTable().getId(),
			item.getOrder().getTable().getLabel(), item.getName(), item.getQuantity(), item.getKitchenStatus(),
			item.getCreatedAt(), allergies == null ? List.of() : allergies, allergyNote);
	}
}
