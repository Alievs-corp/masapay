package az.masapay.kitchen;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import az.masapay.domain.Order;
import az.masapay.domain.OrderItem;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.KitchenStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.kitchen.dto.KitchenLineView;
import az.masapay.realtime.OrderRealtimeBroadcaster;
import az.masapay.repository.OrderItemRepository;
import az.masapay.repository.UserRepository;
import az.masapay.reservation.Reservation;
import az.masapay.reservation.ReservationRepository;
import az.masapay.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/** The chef sees the allergy of a reservation whose guests sit at the bill (spec section 11). */
class KitchenAllergyTest {

	private static final Instant NOW = Instant.parse("2026-11-27T12:00:00Z");

	private final OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
	private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
	@SuppressWarnings("unchecked")
	private final ObjectProvider<OrderRealtimeBroadcaster> broadcaster = mock(ObjectProvider.class);
	private final KitchenService service = new KitchenService(orderItemRepository, mock(UserRepository.class),
			broadcaster, Clock.fixed(NOW, ZoneOffset.UTC));
	private final AuthenticatedUser admin = new AuthenticatedUser(UUID.randomUUID(), "a@x.az", UserRole.SUPER_ADMIN);

	private OrderItem line(Order order, String name) {
		OrderItem item = new OrderItem();
		item.setId(UUID.randomUUID());
		item.setOrder(order);
		item.setName(name);
		item.setQuantity(BigDecimal.ONE);
		item.setKitchenStatus(KitchenStatus.NEW);
		return item;
	}

	private Order order(Restaurant restaurant, String label) {
		RestaurantTable table = new RestaurantTable();
		table.setId(UUID.randomUUID());
		table.setLabel(label);
		Order order = new Order();
		order.setId(UUID.randomUUID());
		order.setRestaurant(restaurant);
		order.setTable(table);
		return order;
	}

	@Test
	void linesOfABillAReservationJoinedCarryItsAllergies() {
		service.setReservationRepository(reservationRepository);
		Restaurant restaurant = new Restaurant();
		restaurant.setId(UUID.randomUUID());
		Order reserved = order(restaurant, "C5");
		Order walkIn = order(restaurant, "T2");
		OrderItem plov = line(reserved, "Plov");
		OrderItem dolma = line(walkIn, "Dolma");
		Reservation reservation = new Reservation();
		reservation.setOrder(reserved);
		reservation.setAllergies(new ArrayList<>(List.of(Allergen.NUTS, Allergen.MILK)));
		reservation.setAllergyNote("Severe, no traces");
		when(orderItemRepository.findKitchenWork(any(), any(), any(), any())).thenReturn(List.of(plov, dolma));
		when(reservationRepository.findByOrderIdIn(anyCollection())).thenReturn(List.of(reservation));

		List<KitchenLineView> work = service.work(restaurant.getId(), admin);

		assertThat(work).filteredOn(v -> v.name().equals("Plov")).singleElement().satisfies(v -> {
			assertThat(v.allergies()).containsExactly(Allergen.NUTS, Allergen.MILK);
			assertThat(v.allergyNote()).isEqualTo("Severe, no traces");
		});
		assertThat(work).filteredOn(v -> v.name().equals("Dolma")).singleElement().satisfies(v -> {
			assertThat(v.allergies()).isEmpty();
			assertThat(v.allergyNote()).isNull();
		});
	}

	@Test
	void withoutTheReservationModuleTheLinesHaveNoAllergies() {
		Restaurant restaurant = new Restaurant();
		restaurant.setId(UUID.randomUUID());
		OrderItem plov = line(order(restaurant, "C5"), "Plov");
		when(orderItemRepository.findKitchenWork(any(), any(), any(), any())).thenReturn(List.of(plov));

		assertThat(service.work(restaurant.getId(), admin)).singleElement()
			.satisfies(v -> assertThat(v.allergies()).isEmpty());
	}
}
