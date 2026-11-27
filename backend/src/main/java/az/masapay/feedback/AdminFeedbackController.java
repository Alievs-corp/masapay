package az.masapay.feedback;

import az.masapay.feedback.dto.FeedbackList;
import az.masapay.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service feedback of a restaurant with the average out of 10. {@code from}/{@code to} are
 * inclusive Asia/Baku dates (default: the last 30 days); {@code minScore}/{@code maxScore} 1-10.
 */
@RestController
@RequestMapping("/api/admin/restaurants/{restaurantId}/feedback")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','RESTO_MANAGER')")
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AdminFeedbackController {

	private final FeedbackService feedbackService;

	public AdminFeedbackController(FeedbackService feedbackService) {
		this.feedbackService = feedbackService;
	}

	@GetMapping
	public FeedbackList list(@AuthenticationPrincipal AuthenticatedUser principal,
		@PathVariable UUID restaurantId,
		@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
		@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
		@RequestParam(required = false) Integer minScore,
		@RequestParam(required = false) Integer maxScore) {
		return feedbackService.list(principal, restaurantId, from, to, minScore, maxScore);
	}
}
