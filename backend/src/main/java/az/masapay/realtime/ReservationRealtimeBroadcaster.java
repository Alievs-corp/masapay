package az.masapay.realtime;

import az.masapay.reservation.dto.ReservationChangedMessage;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Tells the staff reservations page that a booking changed, on
 * /topic/restaurants/{restaurantId}/reservations. Sent after the transaction commits (nothing on a
 * rollback), straight through the local STOMP broker; the page also polls every 30 s, which covers
 * clients connected to another instance when Redis fan-out is on.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationRealtimeBroadcaster {

	private static final Logger log = LoggerFactory.getLogger(ReservationRealtimeBroadcaster.class);

	private final SimpMessagingTemplate messagingTemplate;

	public ReservationRealtimeBroadcaster(SimpMessagingTemplate messagingTemplate) {
		this.messagingTemplate = messagingTemplate;
	}

	static String destination(UUID restaurantId) {
		return "/topic/restaurants/" + restaurantId + "/reservations";
	}

	public void broadcastReservationChanged(UUID restaurantId, UUID reservationId, String localDate) {
		Runnable send = () -> {
			try {
				messagingTemplate.convertAndSend(destination(restaurantId),
					ReservationChangedMessage.of(reservationId, localDate));
			} catch (RuntimeException e) {
				log.warn("Could not push reservation change {}: {}", reservationId, e.getMessage());
			}
		};
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					send.run();
				}
			});
			return;
		}
		send.run();
	}
}
