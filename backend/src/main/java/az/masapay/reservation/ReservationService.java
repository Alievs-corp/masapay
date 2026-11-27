package az.masapay.reservation;

import az.masapay.domain.MenuItem;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.User;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.OrderStatus;
import az.masapay.domain.enums.ReservationSource;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.qr.TableQrUrlBuilder;
import az.masapay.repository.MenuItemRepository;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.UserRepository;
import az.masapay.reservation.dto.AllergenMatches;
import az.masapay.reservation.dto.CreateReservationRequest;
import az.masapay.reservation.dto.FloorAvailability;
import az.masapay.reservation.dto.FloorTable;
import az.masapay.reservation.dto.GuestRequestsRequest;
import az.masapay.reservation.dto.GuestRequestsView;
import az.masapay.reservation.dto.ReservationInfo;
import az.masapay.reservation.dto.ReservationItemRequest;
import az.masapay.reservation.dto.ReservationRulesView;
import az.masapay.reservation.dto.ReservationTableView;
import az.masapay.reservation.dto.ReservationView;
import az.masapay.reservation.dto.TableLocation;
import az.masapay.restaurant.RestaurantGate;
import az.masapay.security.AuthenticatedUser;
import az.masapay.table.dto.TableSummary;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reservations of tables and cabins (spec sections 2, 5 and 7): the guest flow with its booking
 * window, staff bookings without it, overlap checks under a table row lock, the policy refunds on
 * cancel and no-show, and the expiry of unseated bookings to NO_SHOW.
 */
@Service
@ConditionalOnProperty(prefix = "masapay.orders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationService {

	public static final ZoneId ZONE = ZoneId.of("Asia/Baku");

	/** Reasons sent with errors, so the screens can tell them apart. */
	public static final String RESERVATION_STATE = "RESERVATION_STATE";
	public static final String RESERVATION_OVERLAP = "RESERVATION_OVERLAP";
	public static final String OUTSIDE_BOOKING_WINDOW = "OUTSIDE_BOOKING_WINDOW";
	public static final String START_IN_PAST = "START_IN_PAST";
	public static final String PARTY_TOO_LARGE = "PARTY_TOO_LARGE";
	public static final String ITEMS_LOCKED = "ITEMS_LOCKED";
	public static final String RESERVATIONS_DISABLED = "RESERVATIONS_DISABLED";
	public static final String DISH_UNAVAILABLE = "DISH_UNAVAILABLE";
	public static final String LAYOUT_OUT_OF_GRID = "LAYOUT_OUT_OF_GRID";
	public static final String INVALID_DEPOSIT = "INVALID_DEPOSIT";
	/** The requests and note can no longer change (spec 11); NOTES_LOCKED is the /notes spelling. */
	public static final String REQUESTS_LOCKED = "REQUESTS_LOCKED";
	public static final String NOTES_LOCKED = "NOTES_LOCKED";
	/** At most this many stored codes are checked in one table lookup. */
	static final int MAX_ARRIVAL_CODES = 10;

	static final Set<ReservationStatus> ACTIVE = EnumSet.of(ReservationStatus.CONFIRMED, ReservationStatus.SEATED);
	/** Staff may still book a start up to this long ago (a walk-in noted afterwards). */
	static final Duration STAFF_PAST_GRACE = Duration.ofHours(1);
	/** The arrival window at the table opens this long before the start. */
	static final Duration ARRIVAL_EARLY = Duration.ofMinutes(60);

	private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	private static final int CODE_LENGTH = 10;
	private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
	private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

	private final ReservationRepository reservationRepository;
	private final RestaurantRepository restaurantRepository;
	private final RestaurantTableRepository tableRepository;
	private final MenuItemRepository menuItemRepository;
	private final OrderRepository orderRepository;
	private final UserRepository userRepository;
	private final ReservationSeatingService seatingService;
	private final ReservationPaymentService paymentService;
	private final TableQrUrlBuilder urlBuilder;
	private final Clock clock;
	private final SecureRandom random = new SecureRandom();

	@Autowired
	public ReservationService(ReservationRepository reservationRepository, RestaurantRepository restaurantRepository,
			RestaurantTableRepository tableRepository, MenuItemRepository menuItemRepository,
			OrderRepository orderRepository, UserRepository userRepository, ReservationSeatingService seatingService,
			ReservationPaymentService paymentService, TableQrUrlBuilder urlBuilder) {
		this(reservationRepository, restaurantRepository, tableRepository, menuItemRepository, orderRepository,
			userRepository, seatingService, paymentService, urlBuilder, Clock.systemUTC());
	}

	public ReservationService(ReservationRepository reservationRepository, RestaurantRepository restaurantRepository,
			RestaurantTableRepository tableRepository, MenuItemRepository menuItemRepository,
			OrderRepository orderRepository, UserRepository userRepository, ReservationSeatingService seatingService,
			ReservationPaymentService paymentService, TableQrUrlBuilder urlBuilder, Clock clock) {
		this.reservationRepository = reservationRepository;
		this.restaurantRepository = restaurantRepository;
		this.tableRepository = tableRepository;
		this.menuItemRepository = menuItemRepository;
		this.orderRepository = orderRepository;
		this.userRepository = userRepository;
		this.seatingService = seatingService;
		this.paymentService = paymentService;
		this.urlBuilder = urlBuilder;
		this.clock = clock;
	}

	// ---------------------------------------------------------------- public (guest)

	@Transactional(readOnly = true)
	public ReservationInfo info(UUID restaurantId) {
		Restaurant restaurant = restaurant(restaurantId);
		ReservationRules rules = restaurant.getReservationRules();
		LocalDate today = today();
		return new ReservationInfo(restaurant.getId(), restaurant.getName(), restaurant.getCurrency(), ZONE.getId(),
			today.toString(), today.plusDays(rules.getBookingWindowDays()).toString(), ReservationRulesView.of(rules),
			floorsOf(tableRepository.findByRestaurantIdOrderByLabelAsc(restaurantId)));
	}

	@Transactional(readOnly = true)
	public FloorAvailability floor(UUID restaurantId, LocalDate date, LocalTime time, Integer partySize,
			AuthenticatedUser staff) {
		Restaurant restaurant = restaurant(restaurantId);
		if (staff != null) {
			checkStaff(staff, restaurantId);
		}
		LocalDate day = date != null ? date : today();
		LocalTime at = time != null ? time : LocalTime.now(clock.withZone(ZONE)).withSecond(0).withNano(0);
		Instant start = at(day, at);
		Instant end = start.plus(Duration.ofMinutes(restaurant.getReservationRules().getDefaultDurationMinutes()));
		List<RestaurantTable> tables = tableRepository.findByRestaurantIdOrderByLabelAsc(restaurantId);
		List<FloorTable> floor = floorTables(restaurant, tables, start, end, partySize, staff != null);
		return new FloorAvailability(day.toString(), at.format(HH_MM), floorsOf(tables), floor);
	}

	@Transactional
	public ReservationView createByGuest(UUID restaurantId, CreateReservationRequest request) {
		return view(create(restaurantId, request, null), false, true);
	}

	@Transactional
	public ReservationView getByCode(String code) {
		Reservation reservation = byCode(code);
		refreshExpiry(reservation);
		return view(reservation, false, true);
	}

	@Transactional
	public ReservationView updateItems(String code, List<ReservationItemRequest> items) {
		Reservation reservation = byCode(code);
		refreshExpiry(reservation);
		if (reservation.getStatus() != ReservationStatus.CONFIRMED
				|| ReservationMath.money(reservation.getPaidAmount()).signum() > 0) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, ITEMS_LOCKED);
		}
		replaceItems(reservation, items);
		ReservationMath.recompute(reservation);
		reservationRepository.save(reservation);
		paymentService.changed(reservation);
		return view(reservation, false, true);
	}

	/**
	 * The guest replaces the special requests and the note (spec 11) while the booking is
	 * CONFIRMED and has not started; {@code lockedReason} is the 409 reason otherwise.
	 */
	@Transactional
	public ReservationView updateRequests(String code, GuestRequestsRequest requests, String note,
			String lockedReason) {
		Reservation reservation = byCode(code);
		refreshExpiry(reservation);
		if (!canEditRequests(reservation, now())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, lockedReason);
		}
		applyRequests(reservation, requests);
		reservation.setNote(blankToNull(note));
		reservationRepository.save(reservation);
		paymentService.changed(reservation);
		return view(reservation, false, true);
	}

	/** The guest cancels before the start; the paid part is refunded by the policy. */
	@Transactional
	public ReservationView cancelByGuest(String code, String reason) {
		Reservation reservation = byCode(code);
		refreshExpiry(reservation);
		if (reservation.getStatus() != ReservationStatus.CONFIRMED || !now().isBefore(reservation.getStartsAt())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_STATE);
		}
		String error = cancel(reservation, reason, false);
		return view(reservation, false, true).withRefundError(error);
	}

	/**
	 * The reservation a guest holds at this table, when the code belongs to it and it is time:
	 * from an hour before the start until the hold ends, or already seated. Empty otherwise.
	 */
	@Transactional
	public Optional<ReservationView> atTable(UUID qrToken, String code) {
		return atTable(qrToken, code == null ? List.of() : List.of(code));
	}

	/** The first of the guest's stored codes (at most {@value #MAX_ARRIVAL_CODES}) due at this table. */
	@Transactional
	public Optional<ReservationView> atTable(UUID qrToken, List<String> codes) {
		RestaurantTable table = tableByQr(qrToken);
		if (codes == null) {
			return Optional.empty();
		}
		return codes.stream()
			.filter(c -> c != null && !c.isBlank())
			.map(c -> c.strip().toUpperCase())
			.distinct()
			.limit(MAX_ARRIVAL_CODES)
			.map(c -> arrival(table, c))
			.flatMap(Optional::stream)
			.findFirst()
			.map(r -> view(r, false, true));
	}

	/** The guest checks in at the table with the code: the reservation is seated (section 4). */
	@Transactional
	public ReservationView checkIn(UUID qrToken, String code) {
		Reservation reservation = arrival(qrToken, code)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_STATE));
		if (reservation.getStatus() == ReservationStatus.CONFIRMED) {
			seatingService.seat(reservation);
			paymentService.changed(reservation);
		}
		return view(reservation, false, true);
	}

	// ---------------------------------------------------------------- staff

	@Transactional
	public List<ReservationView> listForDay(UUID restaurantId, LocalDate date, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		LocalDate day = date != null ? date : today();
		Instant from = day.atStartOfDay(ZONE).toInstant();
		Instant to = day.plusDays(1).atStartOfDay(ZONE).toInstant();
		List<Reservation> found = reservationRepository
			.findByRestaurantIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAsc(restaurantId, from, to);
		found.forEach(this::refreshExpiry);
		return found.stream().map(r -> view(r, true, false)).toList();
	}

	@Transactional
	public ReservationView getForStaff(UUID restaurantId, UUID id, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		Reservation reservation = byId(restaurantId, id);
		refreshExpiry(reservation);
		return view(reservation, true, true);
	}

	@Transactional
	public ReservationView createByStaff(UUID restaurantId, CreateReservationRequest request, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		User staff = userRepository.findById(caller.id()).orElse(null);
		return view(create(restaurantId, request, caller, staff), true, true);
	}

	@Transactional
	public ReservationView seat(UUID restaurantId, UUID id, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		Reservation reservation = byId(restaurantId, id);
		refreshExpiry(reservation);
		seatingService.seat(reservation);
		paymentService.changed(reservation);
		return view(reservation, true, true);
	}

	@Transactional
	public ReservationView complete(UUID restaurantId, UUID id, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		Reservation reservation = byId(restaurantId, id);
		if (reservation.getStatus() != ReservationStatus.SEATED) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_STATE);
		}
		reservation.setStatus(ReservationStatus.COMPLETED);
		reservationRepository.save(reservation);
		paymentService.changed(reservation);
		return view(reservation, true, true);
	}

	/** Staff cancel any time before the guests are seated; {@code fullRefund} is for managers only. */
	@Transactional
	public ReservationView cancelByStaff(UUID restaurantId, UUID id, String reason, boolean fullRefund,
			AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		if (fullRefund && caller.role() == UserRole.WAITER) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A full refund is for managers");
		}
		Reservation reservation = byId(restaurantId, id);
		refreshExpiry(reservation);
		if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_STATE);
		}
		String error = cancel(reservation, reason, fullRefund);
		return view(reservation, true, true).withRefundError(error);
	}

	@Transactional
	public ReservationView noShow(UUID restaurantId, UUID id, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		Reservation reservation = byId(restaurantId, id);
		if (reservation.getStatus() == ReservationStatus.NO_SHOW) {
			return view(reservation, true, true);
		}
		if (reservation.getStatus() != ReservationStatus.CONFIRMED || now().isBefore(reservation.getStartsAt())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_STATE);
		}
		String error = markNoShow(reservation);
		return view(reservation, true, true).withRefundError(error);
	}

	@Transactional(readOnly = true)
	public ReservationRulesView rules(UUID restaurantId, AuthenticatedUser caller) {
		checkStaff(caller, restaurantId);
		return ReservationRulesView.of(restaurant(restaurantId).getReservationRules());
	}

	@Transactional
	public ReservationRulesView updateRules(UUID restaurantId, ReservationRulesView request, AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		if (request.depositType() == DepositType.PERCENT && request.depositValue().compareTo(HUNDRED) > 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_DEPOSIT);
		}
		Restaurant restaurant = restaurant(restaurantId);
		ReservationRules rules = restaurant.getReservationRules();
		rules.setEnabled(request.enabled());
		rules.setBookingWindowDays(request.bookingWindowDays());
		rules.setHoldMinutes(request.holdMinutes());
		rules.setDefaultDurationMinutes(request.defaultDurationMinutes());
		rules.setDepositType(request.depositType());
		rules.setDepositValue(ReservationMath.money(request.depositValue()));
		rules.setFreeCancelHours(request.freeCancelHours());
		rules.setLateCancelRefundPercent(ReservationMath.money(request.lateCancelRefundPercent()));
		rules.setNoShowRefundPercent(ReservationMath.money(request.noShowRefundPercent()));
		restaurantRepository.save(restaurant);
		return ReservationRulesView.of(rules);
	}

	@Transactional
	public TableSummary updateLocation(UUID restaurantId, UUID tableId, TableLocation location,
			AuthenticatedUser caller) {
		checkManager(caller, restaurantId);
		RestaurantTable table = tableRepository.findById(tableId)
			.filter(t -> t.getRestaurant().getId().equals(restaurantId))
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
		if (location.x().add(location.w()).compareTo(HUNDRED) > 0
				|| location.y().add(location.h()).compareTo(HUNDRED) > 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, LAYOUT_OUT_OF_GRID);
		}
		table.setKind(location.kind());
		table.setFloor(location.floor());
		table.setZone(blankToNull(location.zone()));
		table.setLocationDescription(blankToNull(location.locationDescription()));
		table.setSeats(location.seats());
		table.setLayoutX(ReservationMath.money(location.x()));
		table.setLayoutY(ReservationMath.money(location.y()));
		table.setLayoutW(ReservationMath.money(location.w()));
		table.setLayoutH(ReservationMath.money(location.h()));
		tableRepository.save(table);
		return TableSummary.of(table, urlBuilder.urlFor(table));
	}

	// ---------------------------------------------------------------- expiry (section 7)

	/**
	 * A CONFIRMED booking past its hold turns NO_SHOW (with the no-show refund); a SEATED one whose
	 * bill was cancelled or closed without the payment event turns COMPLETED.
	 */
	@Transactional
	public void refreshExpiry(Reservation reservation) {
		if (reservation.getStatus() == ReservationStatus.CONFIRMED && now().isAfter(reservation.validUntil())) {
			markNoShow(reservation);
		} else if (reservation.getStatus() == ReservationStatus.SEATED && reservation.getOrder() != null
				&& reservation.getOrder().getStatus() != OrderStatus.OPEN) {
			reservation.setStatus(ReservationStatus.COMPLETED);
			reservationRepository.save(reservation);
			paymentService.changed(reservation);
		}
	}

	/**
	 * Ids of the bookings the expiry job has to look at: CONFIRMED ones past their hold, and SEATED
	 * ones whose bill is no longer open. The job handles each in its own transaction
	 * ({@link #expireOne}), so one failing refund never holds back the others.
	 */
	@Transactional(readOnly = true)
	public List<UUID> dueIds() {
		List<UUID> ids = new ArrayList<>();
		Instant now = now();
		for (Reservation r : reservationRepository.findByStatusAndStartsAtBefore(ReservationStatus.CONFIRMED, now)) {
			if (now.isAfter(r.validUntil())) {
				ids.add(r.getId());
			}
		}
		reservationRepository.findSeatedWithClosedOrder().forEach(r -> ids.add(r.getId()));
		return ids;
	}

	/** Expires (or completes) one booking; true when it changed. */
	@Transactional
	public boolean expireOne(UUID id) {
		return reservationRepository.findById(id).map(r -> {
			ReservationStatus before = r.getStatus();
			refreshExpiry(r);
			return r.getStatus() != before;
		}).orElse(false);
	}

	/** Expires every overdue CONFIRMED booking; returns how many. Used by the scheduler. */
	@Transactional
	public int expireDue() {
		// The longest hold is 600 minutes, so a start before now covers every candidate.
		List<Reservation> due = reservationRepository.findByStatusAndStartsAtBefore(ReservationStatus.CONFIRMED, now());
		int expired = 0;
		for (Reservation reservation : due) {
			if (now().isAfter(reservation.validUntil())) {
				markNoShow(reservation);
				expired++;
			}
		}
		return expired;
	}

	// ---------------------------------------------------------------- internals

	private Reservation create(UUID restaurantId, CreateReservationRequest request, AuthenticatedUser staff) {
		return create(restaurantId, request, staff, null);
	}

	private Reservation create(UUID restaurantId, CreateReservationRequest request, AuthenticatedUser staff,
			User staffUser) {
		Restaurant restaurant = restaurant(restaurantId);
		RestaurantGate.checkActive(restaurant);
		ReservationRules rules = restaurant.getReservationRules();
		boolean byStaff = staff != null;
		if (!byStaff && !rules.isEnabled()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATIONS_DISABLED);
		}
		// The row lock makes two bookings of the same table check for overlap one after the other.
		RestaurantTable table = tableRepository.findByIdForUpdate(request.tableId())
			.filter(t -> t.getRestaurant().getId().equals(restaurantId))
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
		if (request.partySize() > table.getSeats()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, PARTY_TOO_LARGE);
		}
		Instant now = now();
		Instant startsAt = at(request.date(), request.time());
		checkWindow(rules, request.date(), startsAt, now, byStaff);
		int duration = request.durationMinutes() != null ? request.durationMinutes() : rules.getDefaultDurationMinutes();
		Instant endsAt = startsAt.plus(Duration.ofMinutes(duration));
		if (!reservationRepository.findOverlapping(table.getId(), startsAt, endsAt, ACTIVE).isEmpty()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, RESERVATION_OVERLAP);
		}

		Reservation reservation = new Reservation();
		reservation.setRestaurant(restaurant);
		reservation.setTable(table);
		reservation.setCode(newCode());
		reservation.setGuestName(request.guestName().strip());
		reservation.setGuestPhone(request.guestPhone().strip());
		reservation.setPartySize(request.partySize());
		reservation.setStartsAt(startsAt);
		reservation.setEndsAt(endsAt);
		reservation.setStatus(ReservationStatus.CONFIRMED);
		reservation.setSource(byStaff ? ReservationSource.STAFF : ReservationSource.CUSTOMER);
		reservation.setCreatedBy(staffUser);
		reservation.setNote(blankToNull(request.note()));
		applyRequests(reservation, request.requests());
		reservation.setCurrency(restaurant.getCurrency());
		reservation.setHoldMinutes(rules.getHoldMinutes());
		reservation.setFreeCancelUntil(startsAt.minus(Duration.ofHours(rules.getFreeCancelHours())));
		reservation.setLateCancelRefundPercent(rules.getLateCancelRefundPercent());
		reservation.setNoShowRefundPercent(rules.getNoShowRefundPercent());
		reservation.setDepositType(rules.getDepositType());
		reservation.setDepositValue(ReservationMath.money(rules.getDepositValue()));
		replaceItems(reservation, request.items() == null ? List.of() : request.items());
		ReservationMath.recompute(reservation);
		reservationRepository.save(reservation);
		paymentService.changed(reservation);
		return reservation;
	}

	/**
	 * Guests book only days {@code today .. today + window} (Baku) and only a future start; staff
	 * may book any day, and a start up to an hour ago.
	 */
	static void checkWindow(ReservationRules rules, LocalDate date, Instant startsAt, Instant now, boolean byStaff) {
		if (byStaff) {
			if (startsAt.isBefore(now.minus(STAFF_PAST_GRACE))) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, START_IN_PAST);
			}
			return;
		}
		LocalDate today = now.atZone(ZONE).toLocalDate();
		if (date.isBefore(today) || date.isAfter(today.plusDays(rules.getBookingWindowDays()))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, OUTSIDE_BOOKING_WINDOW);
		}
		if (!startsAt.isAfter(now)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, START_IN_PAST);
		}
	}

	private void replaceItems(Reservation reservation, List<ReservationItemRequest> requested) {
		Map<UUID, Integer> quantities = requested.stream()
			.collect(Collectors.toMap(ReservationItemRequest::menuItemId, ReservationItemRequest::quantity,
				Integer::sum, LinkedHashMap::new));
		Map<UUID, MenuItem> dishes = quantities.isEmpty() ? Map.of()
			: menuItemRepository.findAllById(quantities.keySet()).stream()
				.collect(Collectors.toMap(MenuItem::getId, Function.identity()));
		LocalDate day = reservation.getStartsAt().atZone(ZONE).toLocalDate();
		UUID restaurantId = reservation.getRestaurant().getId();
		List<ReservationItem> items = new ArrayList<>();
		for (Map.Entry<UUID, Integer> entry : quantities.entrySet()) {
			MenuItem dish = dishes.get(entry.getKey());
			if (dish == null || !dish.getRestaurant().getId().equals(restaurantId) || !dish.isAvailableOn(day)) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, DISH_UNAVAILABLE);
			}
			int quantity = Math.min(entry.getValue(), 99);
			ReservationItem item = new ReservationItem();
			item.setReservation(reservation);
			item.setMenuItem(dish);
			item.setName(dish.getName());
			item.setQuantity(quantity);
			item.setUnitPrice(ReservationMath.money(dish.getPrice()));
			item.setTotalPrice(ReservationMath.money(dish.getPrice().multiply(BigDecimal.valueOf(quantity))));
			items.add(item);
		}
		reservation.getItems().clear();
		reservation.getItems().addAll(items);
	}

	/** Copies the special requests onto the booking; null means none. */
	static void applyRequests(Reservation reservation, GuestRequestsRequest requests) {
		GuestRequestsRequest r = requests != null ? requests : new GuestRequestsRequest(0, false, null, null, null);
		reservation.setChildSeats(r.childSeats() == null ? 0 : r.childSeats());
		reservation.setWheelchairAccess(Boolean.TRUE.equals(r.wheelchairAccess()));
		reservation.setOccasion(r.occasion());
		List<Allergen> allergies = r.allergies() == null ? List.of()
			: r.allergies().stream().filter(a -> a != null).distinct().sorted().toList();
		reservation.setAllergies(new ArrayList<>(allergies));
		reservation.setAllergyNote(blankToNull(r.allergyNote()));
	}

	static boolean canEditRequests(Reservation r, Instant now) {
		return r.getStatus() == ReservationStatus.CONFIRMED && now.isBefore(r.getStartsAt());
	}

	/** What the guest page opens (spec 11.3), decided on the server clock. */
	static String phase(Reservation r, Instant now) {
		return switch (r.getStatus()) {
			case SEATED -> ReservationView.PHASE_SEATED;
			case CONFIRMED -> now.isBefore(r.getStartsAt()) ? ReservationView.PHASE_UPCOMING
				: now.isAfter(r.validUntil()) ? ReservationView.PHASE_ENDED : ReservationView.PHASE_ARRIVAL;
			default -> ReservationView.PHASE_ENDED;
		};
	}

	/**
	 * Dishes shown on {@code date} (default today) that match the asked allergens, for the guest's
	 * pre-order (spec 11). {@code hasAllergenData} is false when no such dish has ingredients.
	 */
	@Transactional(readOnly = true)
	public AllergenMatches menuAllergens(UUID restaurantId, List<Allergen> allergens, LocalDate date) {
		restaurant(restaurantId);
		LocalDate day = date != null ? date : today();
		List<MenuItem> shown = menuItemRepository.findByRestaurantIdOrderByNameAsc(restaurantId).stream()
			.filter(dish -> dish.isAvailableOn(day))
			.toList();
		List<Allergen> asked = allergens == null ? List.of() : allergens;
		List<AllergenMatches.Match> matches = shown.stream()
			.map(dish -> new AllergenMatches.Match(dish.getId(), AllergenMatcher.match(dish, asked)))
			.filter(m -> !m.allergens().isEmpty())
			.toList();
		return new AllergenMatches(shown.stream().anyMatch(AllergenMatcher::hasData), matches);
	}

	private String cancel(Reservation reservation, String reason, boolean fullRefund) {
		BigDecimal refund = ReservationMath.cancelRefund(reservation, now(), fullRefund);
		reservation.setStatus(ReservationStatus.CANCELLED);
		reservation.setCancelledAt(now());
		reservation.setCancelReason(blankToNull(reason));
		reservationRepository.save(reservation);
		String error = paymentService.refund(reservation, refund, "Reservation cancelled");
		paymentService.changed(reservation);
		return error;
	}

	private String markNoShow(Reservation reservation) {
		BigDecimal refund = ReservationMath.noShowRefund(reservation);
		reservation.setStatus(ReservationStatus.NO_SHOW);
		reservationRepository.save(reservation);
		String error = paymentService.refund(reservation, refund, "Reservation no-show");
		paymentService.changed(reservation);
		return error;
	}

	private RestaurantTable tableByQr(UUID qrToken) {
		return tableRepository.findByQrToken(qrToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
	}

	private Optional<Reservation> arrival(UUID qrToken, String code) {
		return arrival(tableByQr(qrToken), code);
	}

	private Optional<Reservation> arrival(RestaurantTable table, String code) {
		if (code == null || code.isBlank()) {
			return Optional.empty();
		}
		Optional<Reservation> found = reservationRepository.findByCode(code.strip().toUpperCase())
			.filter(r -> r.getTable().getId().equals(table.getId()));
		found.ifPresent(this::refreshExpiry);
		Instant now = now();
		return found.filter(r -> r.getStatus() == ReservationStatus.SEATED
			|| (r.getStatus() == ReservationStatus.CONFIRMED && !now.isBefore(r.getStartsAt().minus(ARRIVAL_EARLY))
				&& !now.isAfter(r.validUntil())));
	}

	ReservationView view(Reservation r, boolean staff, boolean withFloor) {
		Instant now = now();
		BigDecimal amountDue = ReservationMath.amountDue(r.getItemsTotal(), r.getDepositAmount());
		BigDecimal remaining = ReservationMath.remaining(amountDue, r.getPaidAmount());
		BigDecimal toPayNow = ReservationMath.payNow(r.getItemsTotal(), r.getDepositAmount(), r.getPaidAmount());
		List<Allergen> allergies = r.getAllergies() == null ? List.of() : r.getAllergies();
		boolean confirmed = r.getStatus() == ReservationStatus.CONFIRMED;
		boolean canCancel = confirmed && (staff || now.isBefore(r.getStartsAt()));
		boolean canPay = (confirmed && !now.isAfter(r.validUntil()) || r.getStatus() == ReservationStatus.SEATED)
			&& remaining.signum() > 0;
		boolean canEditItems = confirmed && ReservationMath.money(r.getPaidAmount()).signum() == 0;
		ZonedDateTime local = r.getStartsAt().atZone(ZONE);
		List<FloorTable> floorTables = withFloor ? floorAround(r, staff) : List.of();
		return new ReservationView(r.getId(), r.getCode(), r.getRestaurant().getId(), r.getRestaurant().getName(),
			r.getStatus(), r.getPaymentStatus(), r.getSource(), r.getStartsAt(), r.getEndsAt(),
			local.toLocalDate().toString(), local.toLocalTime().format(HH_MM), r.validUntil(), r.getPartySize(),
			r.getGuestName(), staff ? r.getGuestPhone() : maskPhone(r.getGuestPhone()), r.getNote(),
			ReservationTableView.of(r.getTable()), floorTables,
			r.getItems().stream().map(i -> new ReservationView.Item(i.getId(),
				i.getMenuItem() == null ? null : i.getMenuItem().getId(), i.getName(), i.getQuantity(),
				i.getUnitPrice(), i.getTotalPrice(), i.getMenuItem() == null
					? AllergenMatcher.match(i.getName(), allergies)
					: AllergenMatcher.match(i.getMenuItem(), allergies))).toList(),
			r.getCurrency(), ReservationMath.money(r.getItemsTotal()), ReservationMath.money(r.getDepositAmount()),
			amountDue, toPayNow, ReservationMath.money(r.getPaidAmount()),
			ReservationMath.money(r.getRefundedAmount()), remaining,
			new ReservationView.Policy(r.getHoldMinutes(), r.getFreeCancelUntil(), r.getLateCancelRefundPercent(),
				r.getNoShowRefundPercent(), r.getDepositType(), r.getDepositValue()),
			canCancel, canPay, canEditItems, r.getSeatedAt(), r.getCancelledAt(), r.getCancelReason(),
			r.getCreatedAt(), null, GuestRequestsView.of(r), canEditRequests(r, now), canEditRequests(r, now),
				phase(r, now), now);
	}

	/** Tables on the booked table's floor, with their state during this booking. */
	private List<FloorTable> floorAround(Reservation r, boolean staff) {
		int floor = r.getTable().getFloor();
		List<RestaurantTable> tables = tableRepository.findByRestaurantIdOrderByLabelAsc(r.getRestaurant().getId())
			.stream().filter(t -> t.getFloor() == floor).toList();
		return floorTables(r.getRestaurant(), tables, r.getStartsAt(), r.getEndsAt(), r.getPartySize(), staff);
	}

	/**
	 * State of each table for the slot {@code [start, end)}: RESERVED when an active booking overlaps
	 * it, OCCUPIED when the table has an open bill now and the slot starts within the default
	 * duration from now, FREE otherwise.
	 */
	private List<FloorTable> floorTables(Restaurant restaurant, List<RestaurantTable> tables, Instant start,
			Instant end, Integer partySize, boolean staff) {
		Map<UUID, Reservation> reservedBy = new LinkedHashMap<>();
		for (Reservation r : reservationRepository.findByRestaurantInRange(restaurant.getId(), start, end, ACTIVE)) {
			reservedBy.putIfAbsent(r.getTable().getId(), r);
		}
		Instant now = now();
		boolean soon = start.isBefore(now.plus(Duration.ofMinutes(
			restaurant.getReservationRules().getDefaultDurationMinutes()))) && end.isAfter(now);
		Set<UUID> occupied = soon
			? orderRepository.findByRestaurantIdAndStatus(restaurant.getId(), OrderStatus.OPEN).stream()
				.map(o -> o.getTable().getId()).collect(Collectors.toSet())
			: Set.of();
		return tables.stream()
			.sorted(Comparator.comparingInt(RestaurantTable::getFloor).thenComparing(RestaurantTable::getLabel))
			.map(t -> {
				Reservation r = reservedBy.get(t.getId());
				String state = r != null ? FloorTable.RESERVED
					: occupied.contains(t.getId()) ? FloorTable.OCCUPIED : FloorTable.FREE;
				boolean fits = partySize == null || partySize <= t.getSeats();
				return staff && r != null ? FloorTable.of(t, state, fits, r.getId(), List.copyOf(r.getAllergies()))
					: FloorTable.of(t, state, fits, null);
			})
			.toList();
	}

	static List<Integer> floorsOf(List<RestaurantTable> tables) {
		List<Integer> floors = tables.stream().map(RestaurantTable::getFloor).distinct().sorted().toList();
		return floors.isEmpty() ? List.of(1) : floors;
	}

	/** "+994501234567" becomes "+99450*****67": enough for the guest to recognise it. */
	static String maskPhone(String phone) {
		if (phone == null) {
			return null;
		}
		int keepStart = phone.length() > 8 ? 6 : 0;
		int keepEnd = Math.min(2, phone.length());
		StringBuilder masked = new StringBuilder(phone.substring(0, keepStart));
		masked.append("*".repeat(Math.max(0, phone.length() - keepStart - keepEnd)));
		masked.append(phone.substring(phone.length() - keepEnd));
		return masked.toString();
	}

	private String newCode() {
		for (int attempt = 0; attempt < 20; attempt++) {
			StringBuilder code = new StringBuilder(CODE_LENGTH);
			for (int i = 0; i < CODE_LENGTH; i++) {
				code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
			}
			if (!reservationRepository.existsByCode(code.toString())) {
				return code.toString();
			}
		}
		throw new IllegalStateException("Could not find a free reservation code");
	}

	private Reservation byCode(String code) {
		return reservationRepository.findByCode(code == null ? "" : code.strip().toUpperCase())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
	}

	private Reservation byId(UUID restaurantId, UUID id) {
		return reservationRepository.findByIdAndRestaurantId(id, restaurantId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
	}

	private Restaurant restaurant(UUID restaurantId) {
		return restaurantRepository.findById(restaurantId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
	}

	/** Staff of the restaurant (any role) or a super admin. */
	private void checkStaff(AuthenticatedUser caller, UUID restaurantId) {
		if (caller.role() == UserRole.SUPER_ADMIN) {
			return;
		}
		UUID own = userRepository.findById(caller.id())
			.map(User::getRestaurant)
			.map(Restaurant::getId)
			.orElse(null);
		if (!restaurantId.equals(own)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your restaurant");
		}
	}

	private void checkManager(AuthenticatedUser caller, UUID restaurantId) {
		if (caller.role() == UserRole.WAITER) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Managers only");
		}
		checkStaff(caller, restaurantId);
	}

	private Instant at(LocalDate date, LocalTime time) {
		return LocalDateTime.of(date, time.withSecond(0).withNano(0)).atZone(ZONE).toInstant();
	}

	private LocalDate today() {
		return LocalDate.now(clock.withZone(ZONE));
	}

	private Instant now() {
		return Instant.now(clock);
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}
}
