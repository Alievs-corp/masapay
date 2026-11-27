package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.masapay.domain.MenuItem;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.enums.ReservationPaymentStatus;
import az.masapay.domain.enums.ReservationSource;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.qr.TableQrUrlBuilder;
import az.masapay.repository.MenuItemRepository;
import az.masapay.repository.OrderRepository;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.UserRepository;
import az.masapay.reservation.dto.CreateReservationRequest;
import az.masapay.reservation.dto.ReservationItemRequest;
import az.masapay.reservation.dto.ReservationView;
import az.masapay.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ReservationServiceTest {

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
		when(restaurantRepository.findById(restaurant.getId())).thenReturn(Optional.of(restaurant));
		when(tableRepository.findByIdForUpdate(table.getId())).thenReturn(Optional.of(table));
		when(tableRepository.findByRestaurantIdOrderByLabelAsc(restaurant.getId())).thenReturn(List.of(table));
		when(reservationRepository.findOverlapping(any(), any(), any(), anyCollection())).thenReturn(List.of());
		when(reservationRepository.findByRestaurantInRange(any(), any(), any(), anyCollection())).thenReturn(List.of());
	}

	private CreateReservationRequest request(LocalDate date, String time, int party, List<ReservationItemRequest> items) {
		return new CreateReservationRequest(table.getId(), date, LocalTime.parse(time), party, " Aysel ",
			"+994501234567", null, null, items);
	}

	private static void assertReason(Runnable call, HttpStatus status, String reason) {
		assertThatThrownBy(call::run).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
			assertThat(e.getStatusCode()).isEqualTo(status);
			assertThat(e.getReason()).isEqualTo(reason);
		});
	}

	@Test
	void guestBooksOnlyInsideTheWindowAndNeverInThePast() {
		// Window 1 day: today and tomorrow only.
		assertReason(() -> service.createByGuest(restaurant.getId(), request(TODAY.plusDays(2), "19:00", 2, null)),
			HttpStatus.BAD_REQUEST, ReservationService.OUTSIDE_BOOKING_WINDOW);
		assertReason(() -> service.createByGuest(restaurant.getId(), request(TODAY.minusDays(1), "19:00", 2, null)),
			HttpStatus.BAD_REQUEST, ReservationService.OUTSIDE_BOOKING_WINDOW);
		assertReason(() -> service.createByGuest(restaurant.getId(), request(TODAY, "13:30", 2, null)),
			HttpStatus.BAD_REQUEST, ReservationService.START_IN_PAST);
		verify(reservationRepository, never()).save(any());

		ReservationView ok = service.createByGuest(restaurant.getId(), request(TODAY.plusDays(1), "19:00", 2, null));
		assertThat(ok.status()).isEqualTo(ReservationStatus.CONFIRMED);
		assertThat(ok.source()).isEqualTo(ReservationSource.CUSTOMER);
		assertThat(ok.localDate()).isEqualTo("2026-11-28");
		assertThat(ok.localTime()).isEqualTo("19:00");
		assertThat(ok.startsAt()).isEqualTo(Instant.parse("2026-11-28T15:00:00Z"));
		assertThat(ok.endsAt()).isEqualTo(Instant.parse("2026-11-28T17:00:00Z"));
		assertThat(ok.guestPhone()).isEqualTo("+99450*****67");
		assertThat(ok.guestName()).isEqualTo("Aysel");
	}

	@Test
	void staffBookAnyDayWithoutTheGuestWindow() {
		ReservationView view = service.createByStaff(restaurant.getId(),
			request(TODAY.plusDays(30), "20:00", 4, null), superAdmin);

		assertThat(view.source()).isEqualTo(ReservationSource.STAFF);
		assertThat(view.guestPhone()).isEqualTo("+994501234567");
		// ...but not a start long gone.
		assertReason(() -> service.createByStaff(restaurant.getId(), request(TODAY, "11:00", 2, null), superAdmin),
			HttpStatus.BAD_REQUEST, ReservationService.START_IN_PAST);
	}

	@Test
	void anOverlappingActiveBookingOfTheSameTableIsRejected() {
		Reservation other = new Reservation();
		when(reservationRepository.findOverlapping(eq(table.getId()), any(), any(), anyCollection()))
			.thenReturn(List.of(other));

		assertReason(() -> service.createByStaff(restaurant.getId(), request(TODAY, "19:00", 2, null), superAdmin),
			HttpStatus.CONFLICT, ReservationService.RESERVATION_OVERLAP);
		// The check runs under the table row lock.
		verify(tableRepository).findByIdForUpdate(table.getId());
	}

	@Test
	void aPartyLargerThanTheTableIsRejected() {
		assertReason(() -> service.createByGuest(restaurant.getId(), request(TODAY, "19:00", 5, null)),
			HttpStatus.BAD_REQUEST, ReservationService.PARTY_TOO_LARGE);
	}

	@Test
	void preOrderAndDepositGiveTheAmountsAndAnUnpaidStatus() {
		restaurant.getReservationRules().setDepositType(DepositType.FIXED);
		restaurant.getReservationRules().setDepositValue(new BigDecimal("10.00"));
		MenuItem dish = new MenuItem();
		dish.setId(UUID.randomUUID());
		dish.setRestaurant(restaurant);
		dish.setName("Dolma");
		dish.setPrice(new BigDecimal("12.50"));
		when(menuItemRepository.findAllById(any())).thenReturn(List.of(dish));

		ReservationView view = service.createByGuest(restaurant.getId(), request(TODAY, "19:00", 2,
			List.of(new ReservationItemRequest(dish.getId(), 2))));

		assertThat(view.itemsTotal()).isEqualByComparingTo("25.00");
		assertThat(view.depositAmount()).isEqualByComparingTo("10.00");
		assertThat(view.amountDue()).isEqualByComparingTo("25.00");
		assertThat(view.amountToPayNow()).isEqualByComparingTo("10.00");
		assertThat(view.remaining()).isEqualByComparingTo("25.00");
		assertThat(view.paymentStatus()).isEqualTo(ReservationPaymentStatus.UNPAID);
		assertThat(view.canPay()).isTrue();
		assertThat(view.canEditItems()).isTrue();
		assertThat(view.items()).singleElement().satisfies(i -> assertThat(i.totalPrice()).isEqualByComparingTo("25.00"));
		// Policy snapshot: free cancel until 2 h before the start.
		assertThat(view.policy().freeCancelUntil()).isEqualTo(Instant.parse("2026-11-27T13:00:00Z"));
	}

	private Reservation existing(Instant startsAt, String paid) {
		Reservation r = new Reservation();
		r.setId(UUID.randomUUID());
		r.setCode("K7Q2M9XP3A");
		r.setRestaurant(restaurant);
		r.setTable(table);
		r.setGuestName("Aysel");
		r.setGuestPhone("+994501234567");
		r.setPartySize(2);
		r.setStartsAt(startsAt);
		r.setEndsAt(startsAt.plusSeconds(7200));
		r.setHoldMinutes(30);
		r.setFreeCancelUntil(startsAt.minusSeconds(7200));
		r.setLateCancelRefundPercent(new BigDecimal("25"));
		r.setNoShowRefundPercent(new BigDecimal("50"));
		r.setPaidAmount(new BigDecimal(paid));
		r.setDepositType(DepositType.FIXED);
		r.setDepositValue(new BigDecimal(paid));
		ReservationMath.recompute(r);
		when(reservationRepository.findByCode(r.getCode())).thenReturn(Optional.of(r));
		when(reservationRepository.findByIdAndRestaurantId(r.getId(), restaurant.getId())).thenReturn(Optional.of(r));
		return r;
	}

	@Test
	void anUnseatedBookingPastItsHoldExpiresToNoShowOnReadWithTheNoShowRefund() {
		Reservation r = existing(NOW.minusSeconds(31 * 60), "20.00");

		ReservationView view = service.getByCode(r.getCode());

		assertThat(view.status()).isEqualTo(ReservationStatus.NO_SHOW);
		ArgumentCaptor<BigDecimal> refund = ArgumentCaptor.forClass(BigDecimal.class);
		verify(paymentService).refund(eq(r), refund.capture(), anyString());
		assertThat(refund.getValue()).isEqualByComparingTo("10.00");
	}

	@Test
	void stillInsideTheHoldTheBookingStaysConfirmed() {
		Reservation r = existing(NOW.minusSeconds(29 * 60), "0");

		assertThat(service.getByCode(r.getCode()).status()).isEqualTo(ReservationStatus.CONFIRMED);
		verify(paymentService, never()).refund(any(), any(), anyString());
	}

	@Test
	void theSchedulerExpiresOnlyBookingsPastTheirHold() {
		Reservation overdue = existing(NOW.minusSeconds(45 * 60), "0");
		Reservation inHold = existing(NOW.minusSeconds(10 * 60), "0");
		when(reservationRepository.findByStatusAndStartsAtBefore(ReservationStatus.CONFIRMED, NOW))
			.thenReturn(List.of(overdue, inHold));

		assertThat(service.expireDue()).isEqualTo(1);
		assertThat(overdue.getStatus()).isEqualTo(ReservationStatus.NO_SHOW);
		assertThat(inHold.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void aGuestCancelBeforeTheDeadlineRefundsEverythingAndALateOneThePercent() {
		Reservation early = existing(NOW.plusSeconds(3 * 3600), "40.00");
		service.cancelByGuest(early.getCode(), "Plans changed");
		assertThat(early.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
		assertThat(early.getCancelReason()).isEqualTo("Plans changed");
		verify(paymentService).refund(eq(early), eq(new BigDecimal("40.00")), anyString());

		Reservation late = existing(NOW.plusSeconds(3600), "40.00");
		late.setCode("LATE234567");
		when(reservationRepository.findByCode("LATE234567")).thenReturn(Optional.of(late));
		service.cancelByGuest("LATE234567", null);
		verify(paymentService).refund(eq(late), eq(new BigDecimal("10.00")), anyString());
	}

	@Test
	void aGuestCannotCancelAfterTheStartAndAWaiterCannotForceAFullRefund() {
		Reservation started = existing(NOW.minusSeconds(60), "0");
		assertReason(() -> service.cancelByGuest(started.getCode(), null), HttpStatus.CONFLICT,
			ReservationService.RESERVATION_STATE);

		AuthenticatedUser waiter = new AuthenticatedUser(UUID.randomUUID(), "w@x.az", UserRole.WAITER);
		assertThatThrownBy(() -> service.cancelByStaff(restaurant.getId(), started.getId(), null, true, waiter))
			.isInstanceOfSatisfying(ResponseStatusException.class,
				e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
	}

	@Test
	void itemsAreLockedOnceSomethingIsPaid() {
		Reservation r = existing(NOW.plusSeconds(3600), "10.00");

		assertReason(() -> service.updateItems(r.getCode(), List.of()), HttpStatus.CONFLICT,
			ReservationService.ITEMS_LOCKED);
	}

	@Test
	void phoneMasking() {
		assertThat(ReservationService.maskPhone("+994501234567")).isEqualTo("+99450*****67");
		assertThat(ReservationService.maskPhone("1234567")).isEqualTo("*****67");
	}
}
