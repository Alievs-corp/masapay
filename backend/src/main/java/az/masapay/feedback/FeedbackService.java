package az.masapay.feedback;

import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.Transaction;
import az.masapay.domain.User;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.feedback.dto.FeedbackEntry;
import az.masapay.feedback.dto.FeedbackList;
import az.masapay.feedback.dto.FeedbackSubmitRequest;
import az.masapay.feedback.dto.FeedbackView;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.TransactionRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service feedback (score 1-10) a guest leaves after a successful payment, and the admin list of
 * it. A score of 6 or lower needs a note; each payment takes one feedback. Days of the admin
 * filter are Asia/Baku calendar days, both ends inclusive.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class FeedbackService {

	public static final ZoneId ZONE = ZoneId.of("Asia/Baku");
	public static final int NOTE_REQUIRED_UP_TO = 6;
	/** Reasons sent with the error, so the phone can tell them apart. */
	public static final String NOTE_REQUIRED = "NOTE_REQUIRED";
	public static final String FEEDBACK_EXISTS = "FEEDBACK_EXISTS";
	public static final String PAYMENT_NOT_SUCCESSFUL = "PAYMENT_NOT_SUCCESSFUL";
	/** Most entries returned by one list call; average and count still cover the whole filter. */
	static final int LIST_LIMIT = 500;
	/** Default period of the admin list when no dates are given. */
	static final int DEFAULT_DAYS = 30;

	private final ServiceFeedbackRepository feedbackRepository;
	private final TransactionRepository transactionRepository;
	private final RestaurantTableRepository tableRepository;
	private final UserRepository userRepository;
	private final Clock clock;

	@Autowired
	public FeedbackService(ServiceFeedbackRepository feedbackRepository, TransactionRepository transactionRepository,
		RestaurantTableRepository tableRepository, UserRepository userRepository) {
		this(feedbackRepository, transactionRepository, tableRepository, userRepository, Clock.systemUTC());
	}

	FeedbackService(ServiceFeedbackRepository feedbackRepository, TransactionRepository transactionRepository,
		RestaurantTableRepository tableRepository, UserRepository userRepository, Clock clock) {
		this.feedbackRepository = feedbackRepository;
		this.transactionRepository = transactionRepository;
		this.tableRepository = tableRepository;
		this.userRepository = userRepository;
		this.clock = clock;
	}

	@Transactional
	public FeedbackView submit(FeedbackSubmitRequest request) {
		int score = request.score();
		if (score < 1 || score > 10) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "score must be 1 to 10");
		}
		String note = request.note() == null ? null : request.note().strip();
		if (note != null && note.isEmpty()) {
			note = null;
		}
		if (score <= NOTE_REQUIRED_UP_TO && note == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NOTE_REQUIRED);
		}
		Transaction tx = transactionRepository.findById(request.transactionId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
		if (tx.getStatus() != TransactionStatus.SUCCESS) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, PAYMENT_NOT_SUCCESSFUL);
		}
		if (feedbackRepository.existsByTransactionId(tx.getId())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, FEEDBACK_EXISTS);
		}

		ServiceFeedback feedback = new ServiceFeedback();
		feedback.setTransaction(tx);
		feedback.setRestaurant(tx.getRestaurant());
		feedback.setScore((short) score);
		feedback.setNote(note);
		feedback.setAmountPaid(tx.getTotalAmount());
		feedback.setCurrency(tx.getCurrency());
		Order order = tx.getOrder();
		feedback.setOrder(order);
		Optional<ServiceFeedbackRepository.ReservationLink> reservation =
			feedbackRepository.findReservationLink(tx.getId());
		if (reservation.isPresent()) {
			feedback.setReservationId(reservation.get().getReservationId());
			feedback.setTable(tableRepository.getReferenceById(reservation.get().getTableId()));
		} else if (order != null) {
			feedback.setTable(order.getTable());
		}
		try {
			feedback = feedbackRepository.saveAndFlush(feedback);
		} catch (DataIntegrityViolationException e) {
			// Two submits of the same payment at once: the unique constraint decides.
			throw new ResponseStatusException(HttpStatus.CONFLICT, FEEDBACK_EXISTS);
		}
		Instant createdAt = feedback.getCreatedAt() != null ? feedback.getCreatedAt() : clock.instant();
		return new FeedbackView(feedback.getId(), score, note, createdAt);
	}

	@Transactional(readOnly = true)
	public FeedbackList list(AuthenticatedUser principal, UUID restaurantId, LocalDate from, LocalDate to,
		Integer minScore, Integer maxScore) {
		LocalDate today = LocalDate.now(clock.withZone(ZONE));
		LocalDate end = to != null ? to : today;
		LocalDate start = from != null ? from : end.minusDays(DEFAULT_DAYS - 1L);
		if (start.isAfter(end)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must not be after 'to'");
		}
		int min = minScore != null ? minScore : 1;
		int max = maxScore != null ? maxScore : 10;
		if (min < 1 || max > 10 || min > max) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score filter must be within 1 to 10");
		}
		checkAccess(principal, restaurantId);

		Instant fromInstant = start.atStartOfDay(ZONE).toInstant();
		Instant toInstant = end.plusDays(1).atStartOfDay(ZONE).toInstant();
		ServiceFeedbackRepository.FeedbackStats stats =
			feedbackRepository.stats(restaurantId, fromInstant, toInstant, min, max);
		long count = stats == null || stats.getCount() == null ? 0 : stats.getCount().longValue();
		BigDecimal average = count == 0 || stats.getAverage() == null ? null
			: new BigDecimal(stats.getAverage().toString()).setScale(1, RoundingMode.HALF_UP);
		List<FeedbackEntry> items = feedbackRepository
			.search(restaurantId, fromInstant, toInstant, min, max, LIST_LIMIT).stream()
			.map(FeedbackService::toEntry)
			.toList();
		return new FeedbackList(average, count, items);
	}

	private static FeedbackEntry toEntry(ServiceFeedbackRepository.FeedbackRow row) {
		String kind = row.getReservationId() != null ? "RESERVATION" : "TABLE_BILL";
		return new FeedbackEntry(row.getId(), row.getScore().intValue(), row.getNote(), row.getTableLabel(), kind,
			row.getReservationCode(), row.getAmountPaid(), row.getCurrency(), row.getCreatedAt());
	}

	/** SUPER_ADMIN sees every restaurant; a RESTO_MANAGER only the one they belong to. */
	private void checkAccess(AuthenticatedUser principal, UUID restaurantId) {
		if (principal.role() == UserRole.SUPER_ADMIN) {
			return;
		}
		if (principal.role() == UserRole.RESTO_MANAGER) {
			UUID own = userRepository.findById(principal.id())
				.map(User::getRestaurant)
				.map(Restaurant::getId)
				.orElse(null);
			if (restaurantId.equals(own)) {
				return;
			}
		}
		throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to this restaurant");
	}
}
