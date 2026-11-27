package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.Order;
import az.masapay.domain.OrderItem;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.order.OpenBillWriter;
import az.masapay.repository.OrderItemRepository;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

class ReservationSeatingServiceTest {

	private static final Instant NOW = Instant.parse("2026-11-27T15:00:00Z");

	private final OpenBillWriter billWriter = mock(OpenBillWriter.class);
	private final OrderRepository orderRepository = mock(OrderRepository.class);
	private final OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
	private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
	private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
	private final ReservationSeatingService service = new ReservationSeatingService(billWriter, orderRepository,
		orderItemRepository, transactionRepository, reservationRepository, Clock.fixed(NOW, ZoneOffset.UTC));

	private final RestaurantTable table = new RestaurantTable();
	private final Order order = new Order();
	private final Reservation reservation = new Reservation();
	private final Transaction prepayment = new Transaction();

	@BeforeEach
	void setUp() {
		Restaurant restaurant = new Restaurant();
		restaurant.setId(UUID.randomUUID());
		table.setId(UUID.randomUUID());
		table.setRestaurant(restaurant);
		order.setId(UUID.randomUUID());
		reservation.setId(UUID.randomUUID());
		reservation.setRestaurant(restaurant);
		reservation.setTable(table);
		reservation.setStartsAt(NOW.plusSeconds(600));
		reservation.setHoldMinutes(30);
		ReservationItem item = new ReservationItem();
		item.setName("Dolma");
		item.setQuantity(2);
		item.setUnitPrice(new BigDecimal("12.50"));
		item.setTotalPrice(new BigDecimal("25.00"));
		reservation.getItems().add(item);
		reservation.setPaidAmount(new BigDecimal("25.00"));
		ReservationMath.recompute(reservation);
		prepayment.setId(UUID.randomUUID());
		prepayment.setReservation(reservation);
		prepayment.setStatus(TransactionStatus.SUCCESS);
		prepayment.setAmount(new BigDecimal("25.00"));
		when(transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(reservation.getId(),
			TransactionStatus.SUCCESS)).thenReturn(List.of(prepayment));
		when(orderRepository.findOpenOrderForUpdate(table.getId())).thenReturn(Optional.of(order));
	}

	@Test
	@SuppressWarnings("unchecked")
	void seatingAddsThePreOrderToTheBillAndMovesThePrepaymentOntoIt() {
		OrderItem added = new OrderItem();
		when(billWriter.append(any(), any())).thenReturn(List.of(added));

		service.seat(reservation);

		ArgumentCaptor<List<OpenBillWriter.NewLine>> lines = ArgumentCaptor.forClass(List.class);
		verify(billWriter).append(org.mockito.ArgumentMatchers.eq(table), lines.capture());
		assertThat(lines.getValue()).singleElement().satisfies(line -> {
			assertThat(line.name()).isEqualTo("Dolma");
			assertThat(line.quantity()).isEqualByComparingTo("2");
			assertThat(line.unitPrice()).isEqualByComparingTo("12.50");
		});
		assertThat(prepayment.getOrder()).isSameAs(order);
		assertThat(prepayment.getReservation()).isSameAs(reservation);
		assertThat(added.isFromReservation()).isTrue();
		// Fully prepaid dishes are marked paid so an item split never charges them again.
		assertThat(added.isPaid()).isTrue();
		assertThat(added.getPaidTransaction()).isSameAs(prepayment);
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.SEATED);
		assertThat(reservation.getOrder()).isSameAs(order);
		assertThat(reservation.getSeatedAt()).isEqualTo(NOW);
	}

	@Test
	void aDepositOnlyBookingStillOpensTheBillForThePrepayment() {
		reservation.getItems().clear();
		reservation.setPaidAmount(new BigDecimal("20.00"));
		ReservationMath.recompute(reservation);
		when(billWriter.openOrFind(table)).thenReturn(order);

		service.seat(reservation);

		verify(billWriter, never()).append(any(), any());
		assertThat(prepayment.getOrder()).isSameAs(order);
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.SEATED);
	}

	@Test
	void aPartlyPaidPreOrderIsNotMarkedPaidItemByItem() {
		reservation.setPaidAmount(new BigDecimal("10.00"));
		ReservationMath.recompute(reservation);
		OrderItem added = new OrderItem();
		when(billWriter.append(any(), any())).thenReturn(List.of(added));

		service.seat(reservation);

		assertThat(added.isFromReservation()).isTrue();
		assertThat(added.isPaid()).isFalse();
	}

	@Test
	void tooEarlyOrNotConfirmedIsRefused() {
		reservation.setStartsAt(NOW.plusSeconds(2 * 3600));
		assertThatThrownBy(() -> service.seat(reservation)).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining(ReservationSeatingService.TOO_EARLY);

		reservation.setStartsAt(NOW);
		reservation.setStatus(ReservationStatus.CANCELLED);
		assertThatThrownBy(() -> service.seat(reservation)).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining(ReservationService.RESERVATION_STATE);
	}
}
