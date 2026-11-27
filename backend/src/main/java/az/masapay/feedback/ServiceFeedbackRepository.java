package az.masapay.feedback;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceFeedbackRepository extends JpaRepository<ServiceFeedback, UUID> {

	boolean existsByTransactionId(UUID transactionId);

	/**
	 * The reservation a payment belongs to and that reservation's table, or empty for a table
	 * bill payment. Native because the transaction's reservation link lives in the reservation
	 * package (V32).
	 */
	@Query(value = "SELECT r.id AS reservationId, r.table_id AS tableId FROM transactions t "
		+ "JOIN reservations r ON r.id = t.reservation_id WHERE t.id = :transactionId", nativeQuery = true)
	Optional<ReservationLink> findReservationLink(@Param("transactionId") UUID transactionId);

	/** Feedback of a restaurant in [from, to) with the score in [minScore, maxScore], newest first. */
	@Query(value = "SELECT f.id AS id, f.score AS score, f.note AS note, tb.label AS tableLabel, "
		+ "r.code AS reservationCode, f.reservation_id AS reservationId, f.amount_paid AS amountPaid, "
		+ "f.currency AS currency, f.created_at AS createdAt "
		+ "FROM service_feedback f "
		+ "LEFT JOIN tables tb ON tb.id = f.table_id "
		+ "LEFT JOIN reservations r ON r.id = f.reservation_id "
		+ "WHERE f.restaurant_id = :restaurantId AND f.created_at >= :from AND f.created_at < :to "
		+ "AND f.score BETWEEN :minScore AND :maxScore "
		+ "ORDER BY f.created_at DESC LIMIT :limit", nativeQuery = true)
	List<FeedbackRow> search(@Param("restaurantId") UUID restaurantId, @Param("from") Instant from,
		@Param("to") Instant to, @Param("minScore") int minScore, @Param("maxScore") int maxScore,
		@Param("limit") int limit);

	/** Count and average score over the same filter (not limited to the returned page). */
	@Query(value = "SELECT count(*) AS count, avg(f.score) AS average FROM service_feedback f "
		+ "WHERE f.restaurant_id = :restaurantId AND f.created_at >= :from AND f.created_at < :to "
		+ "AND f.score BETWEEN :minScore AND :maxScore", nativeQuery = true)
	FeedbackStats stats(@Param("restaurantId") UUID restaurantId, @Param("from") Instant from,
		@Param("to") Instant to, @Param("minScore") int minScore, @Param("maxScore") int maxScore);

	interface ReservationLink {
		UUID getReservationId();

		UUID getTableId();
	}

	interface FeedbackRow {
		UUID getId();

		Number getScore();

		String getNote();

		String getTableLabel();

		String getReservationCode();

		UUID getReservationId();

		java.math.BigDecimal getAmountPaid();

		String getCurrency();

		Instant getCreatedAt();
	}

	interface FeedbackStats {
		Number getCount();

		Number getAverage();
	}
}
