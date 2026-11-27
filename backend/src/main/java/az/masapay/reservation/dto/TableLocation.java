package az.masapay.reservation.dto;

import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.TableKind;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Where a table is: kind, floor, zone, directions, seats and its box on the floor grid (0-100). */
public record TableLocation(
		@NotNull TableKind kind,
		@Min(-5) @Max(50) int floor,
		@Size(max = 50) String zone,
		@Size(max = 255) String locationDescription,
		@Min(1) @Max(100) int seats,
		@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal x,
		@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal y,
		@NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100") BigDecimal w,
		@NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100") BigDecimal h) {

	public static TableLocation of(RestaurantTable t) {
		return new TableLocation(t.getKind(), t.getFloor(), t.getZone(), t.getLocationDescription(), t.getSeats(),
			t.getLayoutX(), t.getLayoutY(), t.getLayoutW(), t.getLayoutH());
	}
}
