package az.masapay.reservation;

import az.masapay.domain.enums.ReservationStatus;
import az.masapay.payment.OrderPaidEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/** A seated reservation is COMPLETED once the bill it joined is fully paid. */
@Component
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationCompletionListener {

	private final ReservationRepository reservationRepository;
	private final ReservationPaymentService paymentService;

	public ReservationCompletionListener(ReservationRepository reservationRepository,
			ReservationPaymentService paymentService) {
		this.reservationRepository = reservationRepository;
		this.paymentService = paymentService;
	}

	@TransactionalEventListener
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void onOrderPaid(OrderPaidEvent event) {
		for (Reservation reservation : reservationRepository.findByOrderIdAndStatus(event.orderId(),
				ReservationStatus.SEATED)) {
			reservation.setStatus(ReservationStatus.COMPLETED);
			reservationRepository.save(reservation);
			paymentService.changed(reservation);
		}
	}
}
