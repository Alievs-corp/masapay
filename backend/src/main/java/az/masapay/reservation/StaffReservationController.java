package az.masapay.reservation;

import az.masapay.reservation.dto.CancelReservationRequest;
import az.masapay.reservation.dto.CreateReservationRequest;
import az.masapay.reservation.dto.FloorAvailability;
import az.masapay.reservation.dto.ReservationRulesView;
import az.masapay.reservation.dto.ReservationView;
import az.masapay.reservation.dto.TableLocation;
import az.masapay.security.AuthenticatedUser;
import az.masapay.table.dto.TableSummary;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
 * Staff side of reservations: the day list and floor, phone bookings without the guest window,
 * seat / complete / cancel / no-show, the restaurant rules and the table locations.
 */
@RestController
@RequestMapping("/api/admin/restaurants/{restaurantId}")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','RESTO_MANAGER','WAITER')")
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class StaffReservationController {

	private final ReservationService reservationService;

	public StaffReservationController(ReservationService reservationService) {
		this.reservationService = reservationService;
	}

	@GetMapping("/reservations")
	public List<ReservationView> list(@PathVariable UUID restaurantId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.listForDay(restaurantId, date, caller);
	}

	@GetMapping("/reservations/floor")
	public FloorAvailability floor(@PathVariable UUID restaurantId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime time,
			@RequestParam(required = false) Integer partySize,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.floor(restaurantId, date, time, partySize, caller);
	}

	@GetMapping("/reservations/{id}")
	public ReservationView get(@PathVariable UUID restaurantId, @PathVariable UUID id,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.getForStaff(restaurantId, id, caller);
	}

	@PostMapping("/reservations")
	@ResponseStatus(HttpStatus.CREATED)
	public ReservationView create(@PathVariable UUID restaurantId, @Valid @RequestBody CreateReservationRequest request,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.createByStaff(restaurantId, request, caller);
	}

	@PostMapping("/reservations/{id}/seat")
	public ReservationView seat(@PathVariable UUID restaurantId, @PathVariable UUID id,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.seat(restaurantId, id, caller);
	}

	@PostMapping("/reservations/{id}/complete")
	public ReservationView complete(@PathVariable UUID restaurantId, @PathVariable UUID id,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.complete(restaurantId, id, caller);
	}

	@PostMapping("/reservations/{id}/cancel")
	public ReservationView cancel(@PathVariable UUID restaurantId, @PathVariable UUID id,
			@Valid @RequestBody(required = false) CancelReservationRequest request,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.cancelByStaff(restaurantId, id, request == null ? null : request.reason(),
			request != null && Boolean.TRUE.equals(request.fullRefund()), caller);
	}

	@PostMapping("/reservations/{id}/no-show")
	public ReservationView noShow(@PathVariable UUID restaurantId, @PathVariable UUID id,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.noShow(restaurantId, id, caller);
	}

	@GetMapping("/reservation-rules")
	public ReservationRulesView rules(@PathVariable UUID restaurantId,
			@AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.rules(restaurantId, caller);
	}

	@PutMapping("/reservation-rules")
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','RESTO_MANAGER')")
	public ReservationRulesView updateRules(@PathVariable UUID restaurantId,
			@Valid @RequestBody ReservationRulesView request, @AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.updateRules(restaurantId, request, caller);
	}

	@PutMapping("/tables/{tableId}/location")
	@PreAuthorize("hasAnyRole('SUPER_ADMIN','RESTO_MANAGER')")
	public TableSummary updateLocation(@PathVariable UUID restaurantId, @PathVariable UUID tableId,
			@Valid @RequestBody TableLocation location, @AuthenticationPrincipal AuthenticatedUser caller) {
		return reservationService.updateLocation(restaurantId, tableId, location, caller);
	}
}
