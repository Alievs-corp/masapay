package az.masapay.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.SplitType;
import az.masapay.payment.payriff.PayriffCheckout;
import az.masapay.payment.payriff.PayriffService;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.TransactionRepository;
import az.masapay.reservation.DepositType;
import az.masapay.reservation.Reservation;
import az.masapay.reservation.ReservationItem;
import az.masapay.reservation.ReservationMath;
import az.masapay.reservation.ReservationRepository;
import az.masapay.restaurant.RestaurantGate;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** "Pay now" of a reservation charges what the view shows, also after a partial payment (spec 11.4). */
class PaymentCheckoutReservationTest {

	private final PaymentSettlementService settlementService = mock(PaymentSettlementService.class);
	private final PayriffService payriffService = mock(PayriffService.class);
	private final RestaurantTableRepository tableRepository = mock(RestaurantTableRepository.class);
	private final OrderRepository orderRepository = mock(OrderRepository.class);
	private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
	private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
	private final PaymentCheckoutService service = new PaymentCheckoutService(settlementService, payriffService,
			tableRepository, orderRepository, transactionRepository, new RestaurantGate(tableRepository));

	private final Reservation reservation = new Reservation();

	@BeforeEach
	void setUp() {
		service.setReservationRepository(reservationRepository);
		Restaurant restaurant = new Restaurant();
		restaurant.setId(UUID.randomUUID());
		RestaurantTable table = new RestaurantTable();
		table.setId(UUID.randomUUID());
		table.setQrToken(UUID.randomUUID());
		table.setRestaurant(restaurant);
		when(tableRepository.findRestaurantByQrToken(table.getQrToken())).thenReturn(Optional.of(restaurant));
		reservation.setId(UUID.randomUUID());
		reservation.setCode("PAYX234567");
		reservation.setRestaurant(restaurant);
		reservation.setTable(table);
		reservation.setStartsAt(Instant.now().plusSeconds(3600));
		reservation.setEndsAt(Instant.now().plusSeconds(3 * 3600));
		reservation.setHoldMinutes(30);
		// 50 AZN pre-order with a 30 % deposit: 15 now.
		ReservationItem item = new ReservationItem();
		item.setReservation(reservation);
		item.setName("Plov");
		item.setQuantity(1);
		item.setUnitPrice(new BigDecimal("50.00"));
		item.setTotalPrice(new BigDecimal("50.00"));
		reservation.getItems().add(item);
		reservation.setDepositType(DepositType.PERCENT);
		reservation.setDepositValue(new BigDecimal("30"));
		ReservationMath.recompute(reservation);
		when(reservationRepository.findWithTableByCode("PAYX234567")).thenReturn(Optional.of(reservation));
		when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
			Transaction transaction = inv.getArgument(0);
			transaction.setId(UUID.randomUUID());
			return transaction;
		});
		when(payriffService.startCheckout(any())).thenReturn(new PayriffCheckout("ord-1", "https://pay/ord-1"));
	}

	private Transaction saved() {
		ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
		verify(transactionRepository).save(captor.capture());
		return captor.getValue();
	}

	@Test
	void payNowChargesTheDepositFirst() {
		service.checkoutReservation("payx234567", false);

		Transaction tx = saved();
		assertThat(tx.getAmount()).isEqualByComparingTo("15.00");
		assertThat(tx.getSplitType()).isEqualTo(SplitType.RESERVATION);
		assertThat(tx.getOrder()).isNull();
	}

	@Test
	void afterTheDepositIsPaidPayNowChargesWhatRemainsAsTheViewShows() {
		reservation.setPaidAmount(new BigDecimal("15.00"));
		ReservationMath.recompute(reservation);

		service.checkoutReservation("PAYX234567", false);

		assertThat(saved().getAmount()).isEqualByComparingTo("35.00");
		assertThat(ReservationMath.payNow(reservation.getItemsTotal(), reservation.getDepositAmount(),
			reservation.getPaidAmount())).isEqualByComparingTo("35.00");
	}

	@Test
	void aPartOfTheDepositPaidLeavesTheRestOfTheDeposit() {
		reservation.setPaidAmount(new BigDecimal("5.00"));
		ReservationMath.recompute(reservation);

		service.checkoutReservation("PAYX234567", false);

		assertThat(saved().getAmount()).isEqualByComparingTo("10.00");
	}

	@Test
	void aConfirmedBookingPastItsHoldCannotBePaid() {
		reservation.setStartsAt(Instant.now().minusSeconds(31 * 60));
		reservation.setStatus(ReservationStatus.CONFIRMED);

		assertThatThrownBy(() -> service.checkoutReservation("PAYX234567", true))
			.isInstanceOfSatisfying(ResponseStatusException.class, e -> {
				assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
				assertThat(e.getReason()).isEqualTo("RESERVATION_STATE");
			});
	}

	@Test
	void aFullyPaidBookingHasNothingToPay() {
		reservation.setPaidAmount(new BigDecimal("50.00"));
		ReservationMath.recompute(reservation);

		assertThatThrownBy(() -> service.checkoutReservation("PAYX234567", false))
			.isInstanceOfSatisfying(ResponseStatusException.class,
				e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
	}
}
