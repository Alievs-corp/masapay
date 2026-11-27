package az.masapay.feedback.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** One row of the admin feedback list; {@code kind} is TABLE_BILL or RESERVATION. */
public record FeedbackEntry(UUID id, int score, String note, String tableLabel, String kind,
	String reservationCode, BigDecimal amountPaid, String currency, Instant createdAt) {
}
