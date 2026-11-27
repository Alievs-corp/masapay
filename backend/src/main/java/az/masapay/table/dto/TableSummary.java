package az.masapay.table.dto;

import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.TableKind;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * A table as listed in the admin panel, with the customer link its QR code encodes.
 * {@code serviceChargePercent} is the table's own setting (null follows the restaurant, 0 is none)
 * and {@code effectiveServiceChargePercent} what its bills are charged (null when nothing) (#146).
 * The location fields (kind, floor, zone, description, seats and the 0-100 box x/y/w/h) place it
 * on the reservation floor plan.
 */
public record TableSummary(UUID id, String label, String status, UUID qrToken, String customerUrl,
		BigDecimal serviceChargePercent, BigDecimal effectiveServiceChargePercent,
		TableKind kind, int floor, String zone, String locationDescription, int seats,
		BigDecimal x, BigDecimal y, BigDecimal w, BigDecimal h) {

	public static TableSummary of(RestaurantTable table, String customerUrl) {
		return new TableSummary(table.getId(), table.getLabel(), table.getStatus().name(), table.getQrToken(),
			customerUrl, table.getServiceChargePercent(), table.effectiveServiceChargePercent(),
			table.getKind(), table.getFloor(), table.getZone(), table.getLocationDescription(), table.getSeats(),
			table.getLayoutX(), table.getLayoutY(), table.getLayoutW(), table.getLayoutH());
	}
}
