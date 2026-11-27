package az.masapay.feedback.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** A guest's rating after a successful payment; a note is required for a score of 6 or lower. */
public record FeedbackSubmitRequest(
	@NotNull UUID transactionId,
	@NotNull @Min(1) @Max(10) Integer score,
	@Size(max = 1000) String note) {
}
