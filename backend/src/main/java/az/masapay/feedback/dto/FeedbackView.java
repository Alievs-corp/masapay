package az.masapay.feedback.dto;

import java.time.Instant;
import java.util.UUID;

public record FeedbackView(UUID id, int score, String note, Instant createdAt) {
}
