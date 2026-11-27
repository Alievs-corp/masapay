package az.masapay.table.dto;

import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.TableKind;
import az.masapay.order.dto.OrderView;
import az.masapay.order.dto.TableOrderResponse;
import az.masapay.table.FloorStatus;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One table on the live floor plan (#44). Amounts are null for an empty table; {@code minutesOpen}
 * is set only while the bill is still open. The location fields place it on the 2D plan; they are
 * null in the realtime push, which only carries the bill (the page keeps them from its load).
 * {@code allergies} are those of the reservation whose guests sit at the bill (null when none).
 */
public record FloorTableView(
		UUID tableId, String label, FloorStatus status, String currency, BigDecimal totalAmount,
		BigDecimal paidAmount, BigDecimal outstanding, Instant openedAt, Long minutesOpen,
		TableKind kind, Integer floor, String zone, String locationDescription, Integer seats,
		BigDecimal x, BigDecimal y, BigDecimal w, BigDecimal h, List<Allergen> allergies) {

	/** Builds the floor entry from the same snapshot the table's customers see. */
	public static FloorTableView of(TableOrderResponse snapshot, Instant now) {
		return of(snapshot, now, null);
	}

	/** The same entry with the table's location. */
	public static FloorTableView of(TableOrderResponse snapshot, Instant now, RestaurantTable table) {
		OrderView order = snapshot.order();
		FloorStatus status = order == null ? FloorStatus.EMPTY : statusOf(order);
		Long minutesOpen = order == null || status == FloorStatus.CLOSED || order.openedAt() == null
			? null
			: Math.max(0, Duration.between(order.openedAt(), now).toMinutes());
		return new FloorTableView(snapshot.tableId(), snapshot.tableLabel(), status, snapshot.currency(),
			order == null ? null : order.totalAmount(), order == null ? null : order.paidAmount(),
			order == null ? null : order.outstanding(), order == null ? null : order.openedAt(), minutesOpen,
			table == null ? null : table.getKind(), table == null ? null : table.getFloor(),
			table == null ? null : table.getZone(), table == null ? null : table.getLocationDescription(),
			table == null ? null : table.getSeats(), table == null ? null : table.getLayoutX(),
			table == null ? null : table.getLayoutY(), table == null ? null : table.getLayoutW(),
			table == null ? null : table.getLayoutH(), allergiesOf(order));
	}

	/** The allergies of the reservation on the bill, for the staff tile; null when none. */
	static List<Allergen> allergiesOf(OrderView order) {
		if (order == null || order.reservation() == null || order.reservation().allergies() == null
				|| order.reservation().allergies().isEmpty()) {
			return null;
		}
		return order.reservation().allergies();
	}

	/** A PAID bill is a closed table; otherwise any successful payment makes it partially paid. */
	static FloorStatus statusOf(OrderView order) {
		if ("PAID".equals(order.status())) {
			return FloorStatus.CLOSED;
		}
		if (order.paidAmount() != null && order.paidAmount().signum() > 0) {
			return FloorStatus.PARTIALLY_PAID;
		}
		return FloorStatus.ACTIVE;
	}
}
