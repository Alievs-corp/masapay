package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.ReservationPaymentStatus;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.payment.PaymentSettlementService;
import az.masapay.payment.payriff.PayriffException;
import az.masapay.payment.refund.RefundService;
import az.masapay.realtime.ReservationRealtimeBroadcaster;
import az.masapay.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class ReservationPaymentServiceTest {

	private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
	private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
	private final RefundService refundService = mock(RefundService.class);
	private final PaymentSettlementService settlementService = mock(PaymentSettlementService.class);
	@SuppressWarnings("unchecked")
	private final ObjectProvider<ReservationRealtimeBroadcaster> broadcaster = mock(ObjectProvider.class);
	private final ReservationPaymentService service = new ReservationPaymentService(transactionRepository,
		reservationRepository, refundService, settlementService, broadcaster,
		Clock.fixed(Instant.parse("2026-11-27T10:00:00Z"), ZoneOffset.UTC));

	private final Reservation reservation = new Reservation();
	private final Transaction payment = new Transaction();

	@BeforeEach
	void setUp() {
		Restaurant restaurant = new Restaurant();
		restaurant.setId(UUID.randomUUID());
		RestaurantTable table = new RestaurantTable();
		table.setRestaurant(restaurant);
		reservation.setId(UUID.randomUUID());
		reservation.setRestaurant(restaurant);
		reservation.setTable(table);
		reservation.setStartsAt(Instant.parse("2026-11-27T15:00:00Z"));
		reservation.setDepositType(DepositType.FIXED);
		reservation.setDepositValue(new BigDecimal("20.00"));
		ReservationItem item = new ReservationItem();
		item.setTotalPrice(new BigDecimal("50.00"));
		reservation.getItems().add(item);
		ReservationMath.recompute(reservation);
		payment.setId(UUID.randomUUID());
		payment.setReservation(reservation);
		payment.setStatus(TransactionStatus.PENDING);
		payment.setAmount(new BigDecimal("20.00"));
		payment.setTotalAmount(new BigDecimal("20.00"));
	}

	@Test
	void anApprovedDepositMakesTheBookingPartiallyPaid() {
		service.settle(payment);

		assertThat(payment.getStatus()).isEqualTo(TransactionStatus.SUCCESS);
		assertThat(payment.getPaidAt()).isNotNull();
		assertThat(payment.getOrder()).isNull();
		assertThat(reservation.getPaidAmount()).isEqualByComparingTo("20.00");
		assertThat(reservation.getPaymentStatus()).isEqualTo(ReservationPaymentStatus.PARTIALLY_PAID);
		verify(settlementService, never()).settleIfFullyPaid(any());
	}

	@Test
	void aPaymentForASeatedBookingGoesOntoItsBill() {
		Order order = new Order();
		reservation.setStatus(ReservationStatus.SEATED);
		reservation.setOrder(order);
		payment.setAmount(new BigDecimal("50.00"));

		service.settle(payment);

		assertThat(payment.getOrder()).isSameAs(order);
		assertThat(reservation.getPaymentStatus()).isEqualTo(ReservationPaymentStatus.PAID);
		verify(settlementService).settleIfFullyPaid(order);
	}

	@Test
	void refundsAreSpreadOverPaymentsNewestFirst() {
		Transaction newer = paid("15.00");
		Transaction older = paid("20.00");
		when(transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(reservation.getId(),
			TransactionStatus.SUCCESS)).thenReturn(List.of(newer, older));
		doAnswer(inv -> {
			Transaction tx = inv.getArgument(0);
			BigDecimal amount = inv.getArgument(1);
			BigDecimal refund = amount.min(tx.getTotalAmount().subtract(tx.getRefundedAmount()));
			tx.setRefundedAmount(tx.getRefundedAmount().add(refund));
			return null;
		}).when(refundService).refundAmount(any(), any(), any());

		String error = service.refund(reservation, new BigDecimal("25.00"), "cancel");

		assertThat(error).isNull();
		assertThat(newer.getRefundedAmount()).isEqualByComparingTo("15.00");
		assertThat(older.getRefundedAmount()).isEqualByComparingTo("10.00");
		assertThat(reservation.getRefundedAmount()).isEqualByComparingTo("25.00");
	}

	@Test
	void aPayriffRefusalIsReportedAndNotRetried() {
		Transaction tx = paid("20.00");
		when(transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(reservation.getId(),
			TransactionStatus.SUCCESS)).thenReturn(List.of(tx));
		doThrow(mock(PayriffException.class)).when(refundService).refundAmount(eq(tx), any(), any());

		assertThat(service.refund(reservation, new BigDecimal("20.00"), "no-show"))
			.isEqualTo(ReservationPaymentService.REFUND_FAILED);
		assertThat(reservation.getRefundedAmount()).isEqualByComparingTo("0");
	}

	private Transaction paid(String amount) {
		Transaction tx = new Transaction();
		tx.setId(UUID.randomUUID());
		tx.setStatus(TransactionStatus.SUCCESS);
		tx.setAmount(new BigDecimal(amount));
		tx.setTotalAmount(new BigDecimal(amount));
		return tx;
	}
}
