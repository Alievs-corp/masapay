package az.masapay.reservation;

import az.masapay.domain.Order;
import az.masapay.domain.Transaction;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Money of a reservation: a confirmed Payriff prepayment ({@link #settle}) and refunds by the
 * policy ({@link #refund}), spread over the reservation's successful payments newest first.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationPaymentService {

	private static final Logger log = LoggerFactory.getLogger(ReservationPaymentService.class);

	/** Sent back when Payriff did not take a policy refund; staff refund by hand from /admin/transactions. */
	public static final String REFUND_FAILED = "REFUND_FAILED";

	private final TransactionRepository transactionRepository;
	private final ReservationRepository reservationRepository;
	private final RefundService refundService;
	private final PaymentSettlementService settlementService;
	private final ObjectProvider<ReservationRealtimeBroadcaster> broadcaster;
	private final Clock clock;

	@Autowired
	public ReservationPaymentService(TransactionRepository transactionRepository,
			ReservationRepository reservationRepository, RefundService refundService,
			PaymentSettlementService settlementService, ObjectProvider<ReservationRealtimeBroadcaster> broadcaster) {
		this(transactionRepository, reservationRepository, refundService, settlementService, broadcaster,
			Clock.systemUTC());
	}

	public ReservationPaymentService(TransactionRepository transactionRepository,
			ReservationRepository reservationRepository, RefundService refundService,
			PaymentSettlementService settlementService, ObjectProvider<ReservationRealtimeBroadcaster> broadcaster,
			Clock clock) {
		this.transactionRepository = transactionRepository;
		this.reservationRepository = reservationRepository;
		this.refundService = refundService;
		this.settlementService = settlementService;
		this.broadcaster = broadcaster;
		this.clock = clock;
	}

	/**
	 * Applies a Payriff-approved reservation payment: SUCCESS, paid amount and payment status up.
	 * A seated reservation's payment goes straight onto its bill. A payment that arrives after the
	 * booking was cancelled or expired is refunded in full.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public void settle(Transaction transaction) {
		Reservation reservation = transaction.getReservation();
		transaction.setStatus(TransactionStatus.SUCCESS);
		transaction.setPaidAt(Instant.now(clock));
		reservation.setPaidAmount(ReservationMath.money(reservation.getPaidAmount()).add(transaction.getAmount()));
		ReservationMath.recompute(reservation);
		Order order = reservation.getOrder();
		if (reservation.getStatus() == ReservationStatus.SEATED && order != null) {
			transaction.setOrder(order);
		}
		transactionRepository.save(transaction);
		reservationRepository.save(reservation);
		if (reservation.getStatus() == ReservationStatus.SEATED && order != null) {
			settlementService.settleIfFullyPaid(order);
		}
		if (reservation.getStatus() == ReservationStatus.CANCELLED
				|| reservation.getStatus() == ReservationStatus.NO_SHOW) {
			log.warn("Payment {} arrived for closed reservation {}; refunding it", transaction.getId(),
				reservation.getCode());
			refund(reservation, transaction.getAmount(), "Reservation is no longer active");
		}
		changed(reservation);
	}

	/**
	 * Refunds {@code amount} of the reservation's payments, newest first, and adds it to the
	 * reservation's refunded amount. Returns {@value #REFUND_FAILED} when Payriff refused or was not
	 * reachable (the part refunded so far stands), otherwise null.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public String refund(Reservation reservation, BigDecimal amount, String reason) {
		BigDecimal left = ReservationMath.money(amount);
		if (left.signum() <= 0 || reservation.getId() == null) {
			return null;
		}
		String error = null;
		for (Transaction tx : transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(
				reservation.getId(), TransactionStatus.SUCCESS)) {
			if (left.signum() <= 0) {
				break;
			}
			BigDecimal before = tx.getRefundedAmount();
			try {
				refundService.refundAmount(tx, left, reason);
			} catch (PayriffException e) {
				log.warn("Payriff did not refund {} of payment {} for reservation {}: {}", left, tx.getId(),
					reservation.getCode(), e.getMessage());
				error = REFUND_FAILED;
				break;
			}
			BigDecimal refunded = tx.getRefundedAmount().subtract(before);
			reservation.setRefundedAmount(ReservationMath.money(reservation.getRefundedAmount()).add(refunded));
			left = left.subtract(refunded);
		}
		reservationRepository.save(reservation);
		return error;
	}

	void changed(Reservation reservation) {
		String localDate = reservation.getStartsAt().atZone(ReservationService.ZONE).toLocalDate().toString();
		broadcaster.ifAvailable(b -> b.broadcastReservationChanged(reservation.getRestaurant().getId(),
			reservation.getId(), localDate));
	}
}
