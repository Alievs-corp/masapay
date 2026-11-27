package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.MenuItem;
import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.Allergen;
import az.masapay.domain.enums.OrderStatus;
import az.masapay.domain.enums.ReservationOccasion;
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
import az.masapay.reservation.dto.GuestRequestsRequest;
import az.masapay.reservation.dto.ReservationItemRequest;
import az.masapay.reservation.dto.ReservationView;
import az.masapay.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Guest requests, allergy warnings and the arrival phase (spec section 11). */
class ReservationGuestRequestsTest {

	/** 14:00 in Baku on 2026-11-27. */
	private static final Instant NOW = Instant.parse("2026-11-27T10:00:00Z");
	private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);

	private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
	private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
	private final RestaurantTableRepository tableRepository = mock(RestaurantTableRepository.class);
	private final MenuItemRepository menuItemRepository = mock(MenuItemRepository.class);
	private final OrderRepository orderRepository = mock(OrderRepository.class);
	private final UserRepository userRepository = mock(UserRepository.class);
	private final ReservationSeatingService seatingService = mock(ReservationSeatingService.class);
	private final ReservationPaymentService paymentService = mock(ReservationPaymentService.class);
	private final ReservationService service = new ReservationService(reservationRepository, restaurantRepository,
		tableRepository, menuItemRepository, orderRepository, userRepository, seatingService, paymentService,
		mock(TableQrUrlBuilder.class), Clock.fixed(NOW, ZoneOffset.UTC));

	private final AuthenticatedUser superAdmin = new AuthenticatedUser(UUID.randomUUID(), "a@x.az", UserRole.SUPER_ADMIN);
	private final Restaurant restaurant = new Restaurant();
	private final RestaurantTable table = new RestaurantTable();

	@BeforeEach
	void setUp() {
		restaurant.setId(UUID.randomUUID());
		restaurant.setName("Dolma");
		table.setId(UUID.randomUUID());
		table.setRestaurant(restaurant);
		table.setLabel("C5");
		table.setSeats(4);
		table.setQrToken(UUID.randomUUID());
		when(restaurantRepository.findById(restaurant.getId())).thenReturn(Optional.of(restaurant));
		when(tableRepository.findByIdForUpdate(table.getId())).thenReturn(Optional.of(table));
		when(tableRepository.findByQrToken(table.getQrToken())).thenReturn(Optional.of(table));
		when(tableRepository.findByRestaurantIdOrderByLabelAsc(restaurant.getId())).thenReturn(List.of(table));
		when(reservationRepository.findOverlapping(any(), any(), any(), anyCollection())).thenReturn(List.of());
		when(reservationRepository.findByRestaurantInRange(any(), any(), any(), anyCollection())).thenReturn(List.of());
	}

	private CreateReservationRequest request(GuestRequestsRequest requests, List<ReservationItemRequest> items) {
		return new CreateReservationRequest(table.getId(), TODAY, LocalTime.parse("19:00"), 2, "Aysel",
			"+994501234567", "Window seat", null, items, requests);
	}

	private Reservation existing(String code, Instant startsAt) {
		Reservation r = new Reservation();
		r.setId(UUID.randomUUID());
		r.setCode(code);
		r.setRestaurant(restaurant);
		r.setTable(table);
		r.setGuestName("Aysel");
		r.setGuestPhone("+994501234567");
		r.setPartySize(2);
		r.setStartsAt(startsAt);
		r.setEndsAt(startsAt.plusSeconds(7200));
		r.setHoldMinutes(30);
		r.setFreeCancelUntil(startsAt.minusSeconds(7200));
		ReservationMath.recompute(r);
		when(reservationRepository.findByCode(code)).thenReturn(Optional.of(r));
		when(reservationRepository.findById(r.getId())).thenReturn(Optional.of(r));
		when(reservationRepository.findByIdAndRestaurantId(r.getId(), restaurant.getId())).thenReturn(Optional.of(r));
		return r;
	}

	private MenuItem dish(String name, String ingredients) {
		MenuItem dish = new MenuItem();
		dish.setId(UUID.randomUUID());
		dish.setRestaurant(restaurant);
		dish.setName(name);
		dish.setIngredients(ingredients);
		dish.setPrice(new BigDecimal("10.00"));
		return dish;
	}

	private static void assertReason(Runnable call, HttpStatus status, String reason) {
		assertThatThrownBy(call::run).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
			assertThat(e.getStatusCode()).isEqualTo(status);
			assertThat(e.getReason()).isEqualTo(reason);
		});
	}

	@Test
	void theRequestsAreStoredOnTheBookingAndReturnedWithBothSpellings() {
		ReservationView view = service.createByGuest(restaurant.getId(), request(new GuestRequestsRequest(2, true,
			ReservationOccasion.BIRTHDAY, List.of(Allergen.MILK, Allergen.NUTS, Allergen.MILK), "  severe  "), null));

		ArgumentCaptor<Reservation> saved = ArgumentCaptor.forClass(Reservation.class);
		verify(reservationRepository).save(saved.capture());
		Reservation r = saved.getValue();
		assertThat(r.getChildSeats()).isEqualTo(2);
		assertThat(r.isWheelchairAccess()).isTrue();
		assertThat(r.getOccasion()).isEqualTo(ReservationOccasion.BIRTHDAY);
		// Duplicates dropped, in the fixed order.
		assertThat(r.getAllergies()).containsExactly(Allergen.NUTS, Allergen.MILK);
		assertThat(r.getAllergyNote()).isEqualTo("severe");
		assertThat(r.getNote()).isEqualTo("Window seat");

		assertThat(view.requests().allergies()).containsExactly(Allergen.NUTS, Allergen.MILK);
		assertThat(view.requests().allergens()).isEqualTo(view.requests().allergies());
		assertThat(view.requests().wheelchair()).isTrue();
		assertThat(view.requests().wheelchairAccess()).isTrue();
		assertThat(view.canEditRequests()).isTrue();
		assertThat(view.canEditNotes()).isTrue();
		assertThat(view.phase()).isEqualTo(ReservationView.PHASE_UPCOMING);
		assertThat(view.serverNow()).isEqualTo(NOW);
	}

	@Test
	void aBookingWithoutRequestsHasEmptyDefaults() {
		ReservationView view = service.createByGuest(restaurant.getId(), request(null, null));

		assertThat(view.requests().childSeats()).isZero();
		assertThat(view.requests().wheelchairAccess()).isFalse();
		assertThat(view.requests().occasion()).isNull();
		assertThat(view.requests().allergies()).isEmpty();
		assertThat(view.requests().allergyNote()).isNull();
	}

	@Test
	void theGuestEditsTheRequestsUntilTheStartOnly() {
		Reservation r = existing("EDIT234567", NOW.plusSeconds(3600));

		ReservationView view = service.updateRequests(r.getCode(), new GuestRequestsRequest(1, false, null,
			List.of(Allergen.GLUTEN), null), "High chair near the window", ReservationService.REQUESTS_LOCKED);

		assertThat(view.requests().childSeats()).isEqualTo(1);
		assertThat(view.requests().allergies()).containsExactly(Allergen.GLUTEN);
		assertThat(view.note()).isEqualTo("High chair near the window");
		verify(paymentService).changed(r);

		Reservation started = existing("LATE234567", NOW.minusSeconds(60));
		assertReason(() -> service.updateRequests(started.getCode(), null, null, ReservationService.NOTES_LOCKED),
			HttpStatus.CONFLICT, ReservationService.NOTES_LOCKED);
		Reservation cancelled = existing("GONE234567", NOW.plusSeconds(3600));
		cancelled.setStatus(ReservationStatus.CANCELLED);
		assertReason(() -> service.updateRequests(cancelled.getCode(), null, null,
			ReservationService.REQUESTS_LOCKED), HttpStatus.CONFLICT, ReservationService.REQUESTS_LOCKED);
	}

	@Test
	void thePhaseFollowsTheStartAndTheHold() {
		assertThat(service.getByCode(existing("UPCO234567", NOW.plusSeconds(60)).getCode()).phase())
			.isEqualTo(ReservationView.PHASE_UPCOMING);
		ReservationView arrival = service.getByCode(existing("ARRI234567", NOW.minusSeconds(10 * 60)).getCode());
		assertThat(arrival.phase()).isEqualTo(ReservationView.PHASE_ARRIVAL);
		assertThat(arrival.canEditRequests()).isFalse();
		// Exactly at the start the arrival view opens.
		assertThat(service.getByCode(existing("EXAC234567", NOW).getCode()).phase())
			.isEqualTo(ReservationView.PHASE_ARRIVAL);
		Reservation seated = existing("SEAT234567", NOW.minusSeconds(3600));
		seated.setStatus(ReservationStatus.SEATED);
		assertThat(service.getByCode(seated.getCode()).phase()).isEqualTo(ReservationView.PHASE_SEATED);
		// Past the hold it expires to NO_SHOW on read: the page shows the status.
		assertThat(service.getByCode(existing("PAST234567", NOW.minusSeconds(31 * 60)).getCode()).phase())
			.isEqualTo(ReservationView.PHASE_ENDED);
	}

	@Test
	void theTableQrFindsTheFirstStoredCodeDueAtThisTable() {
		existing("SOON234567", NOW.plusSeconds(3 * 3600));
		Reservation due = existing("DUEX234567", NOW.minusSeconds(5 * 60));
		RestaurantTable other = new RestaurantTable();
		other.setId(UUID.randomUUID());
		Reservation elsewhere = existing("ELSE234567", NOW.minusSeconds(5 * 60));
		elsewhere.setTable(other);

		Optional<ReservationView> found = service.atTable(table.getQrToken(),
			List.of("soon234567", "ELSE234567", " duex234567 ", "UNKNOWN"));

		assertThat(found).hasValueSatisfying(v -> {
			assertThat(v.code()).isEqualTo(due.getCode());
			assertThat(v.phase()).isEqualTo(ReservationView.PHASE_ARRIVAL);
			assertThat(v.table().label()).isEqualTo("C5");
		});
		assertThat(service.atTable(table.getQrToken(), List.of("SOON234567"))).isEmpty();
		assertThat(service.atTable(table.getQrToken(), List.of())).isEmpty();
	}

	@Test
	void aSeatedBookingWhoseBillWasCancelledCompletesOnReadAndInTheJob() {
		Reservation r = existing("BILL234567", NOW.minusSeconds(3600));
		r.setStatus(ReservationStatus.SEATED);
		Order order = new Order();
		order.setId(UUID.randomUUID());
		order.setStatus(OrderStatus.CANCELLED);
		r.setOrder(order);

		assertThat(service.getByCode(r.getCode()).status()).isEqualTo(ReservationStatus.COMPLETED);

		Reservation open = existing("OPEN234567", NOW.minusSeconds(3600));
		open.setStatus(ReservationStatus.SEATED);
		Order openOrder = new Order();
		openOrder.setId(UUID.randomUUID());
		openOrder.setStatus(OrderStatus.OPEN);
		open.setOrder(openOrder);
		assertThat(service.getByCode(open.getCode()).status()).isEqualTo(ReservationStatus.SEATED);
	}

	@Test
	void theJobHandlesEachDueBookingOnItsOwn() {
		Reservation overdue = existing("OVER234567", NOW.minusSeconds(45 * 60));
		Reservation inHold = existing("HOLD234567", NOW.minusSeconds(10 * 60));
		Reservation seated = existing("SEAX234567", NOW.minusSeconds(3600));
		seated.setStatus(ReservationStatus.SEATED);
		Order paid = new Order();
		paid.setId(UUID.randomUUID());
		paid.setStatus(OrderStatus.CLOSED);
		seated.setOrder(paid);
		when(reservationRepository.findByStatusAndStartsAtBefore(ReservationStatus.CONFIRMED, NOW))
			.thenReturn(List.of(overdue, inHold));
		when(reservationRepository.findSeatedWithClosedOrder()).thenReturn(List.of(seated));

		List<UUID> due = service.dueIds();

		assertThat(due).containsExactly(overdue.getId(), seated.getId());
		assertThat(service.expireOne(overdue.getId())).isTrue();
		assertThat(service.expireOne(seated.getId())).isTrue();
		assertThat(overdue.getStatus()).isEqualTo(ReservationStatus.NO_SHOW);
		assertThat(seated.getStatus()).isEqualTo(ReservationStatus.COMPLETED);
		assertThat(service.expireOne(UUID.randomUUID())).isFalse();
	}

	@Test
	void preOrderedDishesCarryTheAllergenWarningsOfTheGuest() {
		MenuItem baklava = dish("Paxlava", "un, qoz, kərə yağı");
		MenuItem kebab = dish("Lulə kabab", "quzu əti, soğan");
		when(menuItemRepository.findAllById(any())).thenReturn(List.of(baklava, kebab));

		ReservationView view = service.createByGuest(restaurant.getId(), request(
			new GuestRequestsRequest(0, false, null, List.of(Allergen.NUTS, Allergen.SESAME), null),
			List.of(new ReservationItemRequest(baklava.getId(), 1), new ReservationItemRequest(kebab.getId(), 1))));

		assertThat(view.items()).hasSize(2);
		assertThat(view.items()).filteredOn(i -> i.menuItemId().equals(baklava.getId())).singleElement()
			.satisfies(i -> assertThat(i.allergenWarnings()).containsExactly(Allergen.NUTS));
		assertThat(view.items()).filteredOn(i -> i.menuItemId().equals(kebab.getId())).singleElement()
			.satisfies(i -> assertThat(i.allergenWarnings()).isEmpty());
	}

	@Test
	void theMenuAllergenLookupFlagsDishesAndSaysWhenThereIsNoData() {
		MenuItem cake = dish("Cheesecake", null);
		cake.setDescription("With cream cheese and a biscuit base");
		MenuItem salad = dish("Çoban salatı", null);
		when(menuItemRepository.findByRestaurantIdOrderByNameAsc(restaurant.getId())).thenReturn(List.of(cake, salad));

		AllergenMatches noData = service.menuAllergens(restaurant.getId(), List.of(Allergen.MILK), TODAY);
		assertThat(noData.hasAllergenData()).isFalse();
		assertThat(noData.matches()).singleElement().satisfies(m -> {
			assertThat(m.menuItemId()).isEqualTo(cake.getId());
			assertThat(m.allergens()).containsExactly(Allergen.MILK);
		});

		salad.setIngredients("pomidor, xiyar, soğan");
		assertThat(service.menuAllergens(restaurant.getId(), List.of(Allergen.MILK), TODAY).hasAllergenData())
			.isTrue();
		assertThat(service.menuAllergens(restaurant.getId(), null, null).matches()).isEmpty();
	}

	@Test
	void staffFloorShowsTheAllergiesOfTheBookingThatReservesATable() {
		Reservation r = existing("FLOR234567", NOW.plusSeconds(3600));
		r.setAllergies(new ArrayList<>(List.of(Allergen.PEANUTS)));
		when(reservationRepository.findByRestaurantInRange(any(), any(), any(), anyCollection())).thenReturn(List.of(r));

		FloorAvailability staff = service.floor(restaurant.getId(), TODAY, LocalTime.of(15, 0), 2, superAdmin);
		FloorAvailability guest = service.floor(restaurant.getId(), TODAY, LocalTime.of(15, 0), 2, null);

		assertThat(staff.tables()).singleElement().satisfies(t -> {
			assertThat(t.reservationId()).isEqualTo(r.getId());
			assertThat(t.allergies()).containsExactly(Allergen.PEANUTS);
		});
		assertThat(guest.tables()).singleElement().satisfies(t -> {
			assertThat(t.reservationId()).isNull();
			assertThat(t.allergies()).isNull();
		});
	}

	@Test
	void bothJsonSpellingsOfTheRequestsAreAccepted() throws Exception {
		ObjectMapper json = JsonMapper.builder().findAndAddModules().build();
		GuestRequestsRequest customer = json.readValue(
			"{\"childSeats\":1,\"wheelchair\":true,\"occasion\":\"BUSINESS\",\"allergens\":[\"SOY\"],\"allergyNote\":null}",
			GuestRequestsRequest.class);
		GuestRequestsRequest admin = json.readValue(
			"{\"childSeats\":1,\"wheelchairAccess\":true,\"occasion\":\"OTHER\",\"allergies\":[\"SOY\"]}",
			GuestRequestsRequest.class);

		assertThat(customer.wheelchairAccess()).isTrue();
		assertThat(customer.allergies()).containsExactly(Allergen.SOY);
		assertThat(admin.wheelchairAccess()).isTrue();
		assertThat(admin.occasion()).isEqualTo(ReservationOccasion.OTHER);
		assertThat(admin.allergies()).containsExactly(Allergen.SOY);
	}
}
