package az.masapay.feedback.dto;

import java.math.BigDecimal;
import java.util.List;

/** Average score out of 10 (one decimal, null when empty) and count over the whole filter. */
public record FeedbackList(BigDecimal averageScore, long count, List<FeedbackEntry> items) {
}
