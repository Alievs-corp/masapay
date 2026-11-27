package az.masapay.order;

import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.OrderStatus;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.order.dto.OrderView;
import az.masapay.order.dto.TableOrderResponse;
import az.masapay.repository.OrderItemRepository;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.TransactionRepository;
import az.masapay.reservation.ReservationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Resolves the live order for a table from its QR token, for the customer PWA. */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class CustomerOrderService {

	/** How long a fully paid bill stays visible on the table page as a receipt. */
	static final Duration RECEIPT_WINDOW = Duration.ofHours(2);
	/** A cancelled order is shown this long, so the guests see it was cancelled (#186). */
	static final Duration CANCELLED_WINDOW = Duration.ofMinutes(15);

	private final RestaurantTableRepository tableRepository;
	private final OrderRepository orderRepository;
	private final OrderItemRepository orderItemRepository;
	private final TransactionRepository transactionRepository;
	private ReservationRepository reservationRepository;

	/** Set by Spring; optional so the bill works without the reservation module (and in older tests). */
	@Autowired(required = false)
	public void setReservationRepository(ReservationRepository reservationRepository) {
		this.reservationRepository = reservationRepository;
	}

	public CustomerOrderService(RestaurantTableRepository tableRepository, OrderRepository orderRepository,
			OrderItemRepository orderItemRepository, TransactionRepository transactionRepository) {
		this.tableRepository = tableRepository;
		this.orderRepository = orderRepository;
		this.orderItemRepository = orderItemRepository;
		this.transactionRepository = transactionRepository;
	}

	@Transactional(readOnly = true)
	public TableOrderResponse getCurrentOrder(UUID qrToken) {
		RestaurantTable table = tableRepository.findByQrToken(qrToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
		Restaurant restaurant = table.getRestaurant();

		// No open bill: show the one paid in the last hours as a receipt, so the guest who just paid
		// (and everyone else at the table) still sees what was paid instead of an empty table.
		OrderView orderView = orderRepository
			.findFirstByTableIdAndStatusOrderByOpenedAtDesc(table.getId(), OrderStatus.OPEN)
			.or(() -> orderRepository.findFirstByTableIdAndStatusAndClosedAtAfterOrderByClosedAtDesc(
				table.getId(), OrderStatus.PAID, Instant.now().minus(RECEIPT_WINDOW)))
			.or(() -> orderRepository.findFirstByTableIdAndStatusAndClosedAtAfterOrderByClosedAtDesc(
				table.getId(), OrderStatus.CANCELLED, Instant.now().minus(CANCELLED_WINDOW)))
			.map(this::toOrderView)
			.orElse(null);

		return new TableOrderResponse(
			table.getId(), table.getLabel(), restaurant.getId(), restaurant.getName(),
			restaurant.getCurrency(), table.effectiveServiceChargePercent(), orderView);
	}

	private OrderView toOrderView(Order order) {
		BigDecimal paid = transactionRepository.findByOrderIdAndStatus(order.getId(), TransactionStatus.SUCCESS).stream()
			.map(Transaction::getAmount)
			.reduce(BigDecimal.ZERO, BigDecimal::add);
		OrderView view = OrderView.of(order, orderItemRepository.findByOrderId(order.getId()), paid);
		if (reservationRepository == null) {
			return view;
		}
		// Guests seated from a reservation see its code and what they prepaid on the bill.
		return reservationRepository.findFirstByOrderId(order.getId())
			.map(r -> view.withReservation(new OrderView.ReservationInfo(r.getCode(), r.getGuestName(),
				r.getPaidAmount().subtract(r.getRefundedAmount()).max(BigDecimal.ZERO),
				r.getAllergies() == null ? List.of() : List.copyOf(r.getAllergies()), r.getAllergyNote(),
				r.getChildSeats(), r.isWheelchairAccess(), r.getOccasion(), r.getNote())))
			.orElse(view);
	}
}
