package az.masapay.reservation;

import az.masapay.menu.MenuService;
import az.masapay.menu.dto.MenuCategoryView;
import az.masapay.payment.PaymentCheckoutService;
import az.masapay.payment.dto.CheckoutResponse;
import az.masapay.domain.enums.Allergen;
import az.masapay.reservation.dto.AllergenMatches;
import az.masapay.reservation.dto.CancelReservationRequest;
import az.masapay.reservation.dto.CheckInRequest;
import az.masapay.reservation.dto.CreateReservationRequest;
import az.masapay.reservation.dto.FloorAvailability;
import az.masapay.reservation.dto.ReservationCheckoutRequest;
import az.masapay.reservation.dto.ReservationInfo;
import az.masapay.reservation.dto.ReservationItemsRequest;
import az.masapay.reservation.dto.ReservationView;
import az.masapay.reservation.dto.UpdateGuestRequestsRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The guest side of reservations (no login). The restaurant id, the reservation code and the table
 * QR token are the access keys, like the table QR flow.
 */
@RestController
@RequestMapping("/api/public")
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PublicReservationController {

	private final ReservationService reservationService;
	private final PaymentCheckoutService checkoutService;
	private final MenuService menuService;

	public PublicReservationController(ReservationService reservationService, PaymentCheckoutService checkoutService,
			MenuService menuService) {
		this.reservationService = reservationService;
		this.checkoutService = checkoutService;
		this.menuService = menuService;
	}

	@GetMapping("/restaurants/{restaurantId}/reservations/info")
	public ReservationInfo info(@PathVariable UUID restaurantId) {
		return reservationService.info(restaurantId);
	}

	@GetMapping("/restaurants/{restaurantId}/reservations/floor")
	public FloorAvailability floor(@PathVariable UUID restaurantId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime time,
			@RequestParam(required = false) Integer partySize) {
		return reservationService.floor(restaurantId, date, time, partySize, null);
	}

	/** The pre-order menu; {@code date} is the booking day (default today), so its dishes are listed. */
	@GetMapping("/restaurants/{restaurantId}/menu")
	public List<MenuCategoryView> menu(@PathVariable UUID restaurantId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return menuService.customerMenuOfRestaurant(restaurantId, date);
	}

	/** Dishes of that day that match the guest's allergies (spec 11). */
	@GetMapping("/restaurants/{restaurantId}/menu/allergens")
	public AllergenMatches menuAllergens(@PathVariable UUID restaurantId,
			@RequestParam(required = false) List<Allergen> allergens,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return reservationService.menuAllergens(restaurantId, allergens, date);
	}

	@PostMapping("/restaurants/{restaurantId}/reservations")
	@ResponseStatus(HttpStatus.CREATED)
	public ReservationView create(@PathVariable UUID restaurantId,
			@Valid @RequestBody CreateReservationRequest request) {
		return reservationService.createByGuest(restaurantId, request);
	}

	@GetMapping("/reservations/{code}")
	public ReservationView get(@PathVariable String code) {
		return reservationService.getByCode(code);
	}

	@PutMapping("/reservations/{code}/items")
	public ReservationView items(@PathVariable String code, @Valid @RequestBody ReservationItemsRequest request) {
		return reservationService.updateItems(code, request.items());
	}

	/** Replaces the special requests and the note while the booking has not started (spec 11). */
	@PutMapping("/reservations/{code}/requests")
	public ReservationView requests(@PathVariable String code, @Valid @RequestBody UpdateGuestRequestsRequest request) {
		return reservationService.updateRequests(code, request.requests(), request.note(),
			ReservationService.REQUESTS_LOCKED);
	}

	/** The same as /requests, under the name the guest page uses. */
	@PutMapping("/reservations/{code}/notes")
	public ReservationView notes(@PathVariable String code, @Valid @RequestBody UpdateGuestRequestsRequest request) {
		return reservationService.updateRequests(code, request.requests(), request.note(),
			ReservationService.NOTES_LOCKED);
	}

	@PostMapping("/reservations/{code}/checkout")
	public CheckoutResponse checkout(@PathVariable String code,
			@RequestBody(required = false) ReservationCheckoutRequest request) {
		boolean payFull = request != null && Boolean.TRUE.equals(request.payFull());
		// Expires an overdue booking first, so a NO_SHOW is never paid for.
		reservationService.getByCode(code);
		return checkoutService.checkoutReservation(code, payFull);
	}

	@PostMapping("/reservations/{code}/cancel")
	public ReservationView cancel(@PathVariable String code,
			@Valid @RequestBody(required = false) CancelReservationRequest request) {
		return reservationService.cancelByGuest(code, request == null ? null : request.reason());
	}

	/**
	 * The first of the given codes ({@code ?code=A&code=B}) booked at this table and due now; 204
	 * when none is (wrong table, not time yet, or no code).
	 */
	@GetMapping("/tables/{qrToken}/reservation")
	public ResponseEntity<ReservationView> atTable(@PathVariable UUID qrToken,
			@RequestParam(name = "code", required = false) List<String> codes) {
		return reservationService.atTable(qrToken, codes == null ? List.of() : codes)
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@PostMapping("/tables/{qrToken}/reservation/check-in")
	public ReservationView checkIn(@PathVariable UUID qrToken, @Valid @RequestBody CheckInRequest request) {
		return reservationService.checkIn(qrToken, request.code());
	}
}
