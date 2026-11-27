package az.masapay.reservation;

import az.masapay.domain.Order;
import az.masapay.domain.OrderItem;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.ReservationPaymentStatus;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.order.OpenBillWriter;
import az.masapay.repository.OrderItemRepository;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Seats a reservation (spec section 4): its pre-ordered dishes join the table's open bill (and go
 * to the kitchen and POS like any other line) and its prepayments are re-linked to that bill, so
 * the bill shows them as paid and the guests pay only the rest. The bill stays open.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationSeatingService {

	public static final String TOO_EARLY = "TOO_EARLY";
	/** How long before the start a booking may be seated. */
	static final Duration EARLY_SEATING = Duration.ofMinutes(60);

	private final OpenBillWriter billWriter;
	private final OrderRepository orderRepository;
	private final OrderItemRepository orderItemRepository;
	private final TransactionRepository transactionRepository;
	private final ReservationRepository reservationRepository;
	private final Clock clock;

	@Autowired
	public ReservationSeatingService(OpenBillWriter billWriter, OrderRepository orderRepository,
			OrderItemRepository orderItemRepository, TransactionRepository transactionRepository,
			ReservationRepository reservationRepository) {
		this(billWriter, orderRepository, orderItemRepository, transactionRepository, reservationRepository,
			Clock.systemUTC());
	}

	public ReservationSeatingService(OpenBillWriter billWriter, OrderRepository orderRepository,
			OrderItemRepository orderItemRepository, TransactionRepository transactionRepository,
			ReservationRepository reservationRepository, Clock clock) {
		this.billWriter = billWriter;
		this.orderRepository = orderRepository;
		this.orderItemRepository = orderItemRepository;
		this.transactionRepository = transactionRepository;
		this.reservationRepository = reservationRepository;
		this.clock = clock;
	}

	@Transactional(propagation = Propagation.REQUIRED)
	public Reservation seat(Reservation reservation) {
		Instant now = Instant.now(clock);
		if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, ReservationService.RESERVATION_STATE);
		}
		if (now.isBefore(reservation.getStartsAt().minus(EARLY_SEATING))) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, TOO_EARLY);
		}
		RestaurantTable table = reservation.getTable();
		List<OpenBillWriter.NewLine> lines = reservation.getItems().stream()
			.map(item -> new OpenBillWriter.NewLine(item.getName(), BigDecimal.valueOf(item.getQuantity()),
				item.getUnitPrice(), item.getMenuItem(), null))
			.toList();
		List<OrderItem> added = lines.isEmpty() ? List.of() : billWriter.append(table, lines);
		Order order = lines.isEmpty() ? billWriter.openOrFind(table)
			: orderRepository.findOpenOrderForUpdate(table.getId())
				.orElseThrow(() -> new IllegalStateException("The bill just written is not open"));

		List<Transaction> payments = transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(
			reservation.getId(), TransactionStatus.SUCCESS);
		for (Transaction payment : payments) {
			payment.setOrder(order);
			transactionRepository.save(payment);
		}

		boolean prepaidDishes = reservation.getPaymentStatus() == ReservationPaymentStatus.PAID
			&& ReservationMath.money(reservation.getPaidAmount()).compareTo(reservation.getItemsTotal()) >= 0
			&& !payments.isEmpty();
		for (OrderItem item : added) {
			item.setFromReservation(true);
			if (prepaidDishes) {
				// Already paid with the reservation: an ITEM split never charges them again.
				item.setPaid(true);
				item.setPaidTransaction(payments.get(0));
			}
			orderItemRepository.save(item);
		}

		reservation.setOrder(order);
		reservation.setStatus(ReservationStatus.SEATED);
		reservation.setSeatedAt(now);
		reservationRepository.save(reservation);
		return reservation;
	}
}
