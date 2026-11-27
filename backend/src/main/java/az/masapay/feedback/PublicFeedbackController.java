package az.masapay.feedback;

import az.masapay.feedback.dto.FeedbackSubmitRequest;
import az.masapay.feedback.dto.FeedbackView;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Guest rating after a successful payment. Public (the transaction id from the payment result
 * page is the key); rate limited like starting a payment (RateLimitFilter).
 */
@RestController
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequestMapping("/api/public/feedback")
public class PublicFeedbackController {

	private final FeedbackService feedbackService;

	public PublicFeedbackController(FeedbackService feedbackService) {
		this.feedbackService = feedbackService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public FeedbackView submit(@Valid @RequestBody FeedbackSubmitRequest request) {
		return feedbackService.submit(request);
	}
}
