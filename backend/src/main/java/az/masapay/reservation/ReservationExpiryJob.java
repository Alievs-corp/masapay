package az.masapay.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Turns CONFIRMED reservations nobody was seated for into NO_SHOW once their hold ends (with the
 * no-show refund). The same check also runs on every read of a single reservation.
 */
@Component
@ConditionalOnExpression("${masapay.orders.enabled:true} and ${masapay.reservations.expiry-enabled:true}")
public class ReservationExpiryJob {

	private static final Logger log = LoggerFactory.getLogger(ReservationExpiryJob.class);

	private final ReservationService reservationService;

	public ReservationExpiryJob(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

	@Scheduled(fixedDelayString = "${masapay.reservations.expiry-interval:PT1M}")
	public void expire() {
		java.util.List<java.util.UUID> due;
		try {
			due = reservationService.dueIds();
		} catch (RuntimeException e) {
			log.error("Reservation expiry failed", e);
			return;
		}
		int changed = 0;
		// One transaction per booking: a failing refund rolls back only that booking.
		for (java.util.UUID id : due) {
			try {
				if (reservationService.expireOne(id)) {
					changed++;
				}
			} catch (RuntimeException e) {
				log.error("Reservation {} could not be expired", id, e);
			}
		}
		if (changed > 0) {
			log.info("{} reservation(s) expired to NO_SHOW or completed", changed);
		}
	}
}
