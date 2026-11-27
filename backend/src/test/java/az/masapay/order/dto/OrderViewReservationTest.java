package az.masapay.order.dto;

import static org.assertj.core.api.Assertions.assertThat;

import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.ReservationOccasion;
import az.masapay.table.dto.FloorTableView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The allergies of the booking on a bill reach staff screens but not the customer channels. */
class OrderViewReservationTest {

	private final OrderView.ReservationInfo info = new OrderView.ReservationInfo("K7Q2M9XP3A", "Aysel",
		new BigDecimal("15.00"), List.of(Allergen.GLUTEN), "Coeliac", 1, true, ReservationOccasion.BIRTHDAY,
		"Cake at 21:00");

	private OrderView bill() {
		return new OrderView(UUID.randomUUID(), "OPEN", new BigDecimal("40.00"), BigDecimal.ZERO,
			new BigDecimal("40.00"), Instant.parse("2026-11-27T15:00:00Z"), List.of(), null, null, null)
			.withReservation(info);
	}

	@Test
	void customersSeeThePrepaymentButNotTheGuestRequests() {
		OrderView.ReservationInfo forCustomers = bill().withoutStaffNames().reservation();

		assertThat(forCustomers.code()).isEqualTo("K7Q2M9XP3A");
		assertThat(forCustomers.prepaidAmount()).isEqualByComparingTo("15.00");
		assertThat(forCustomers.allergies()).isEmpty();
		assertThat(forCustomers.allergyNote()).isNull();
		assertThat(forCustomers.note()).isNull();
		assertThat(forCustomers.childSeats()).isZero();
	}

	@Test
	void theStaffBillAndTheLiveFloorTileCarryTheAllergy() {
		OrderView staff = bill();
		assertThat(staff.reservation().allergies()).containsExactly(Allergen.GLUTEN);

		TableOrderResponse snapshot = new TableOrderResponse(UUID.randomUUID(), "C5", UUID.randomUUID(), "Dolma",
			"AZN", null, staff);
		FloorTableView tile = FloorTableView.of(snapshot, Instant.parse("2026-11-27T15:30:00Z"));
		assertThat(tile.allergies()).containsExactly(Allergen.GLUTEN);

		TableOrderResponse plain = new TableOrderResponse(UUID.randomUUID(), "T1", UUID.randomUUID(), "Dolma",
			"AZN", null, null);
		assertThat(FloorTableView.of(plain, Instant.now()).allergies()).isNull();
	}
}
