package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.enums.ReservationStatus;
import az.masapay.domain.enums.SplitType;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.feedback.ServiceFeedback;
import az.masapay.feedback.ServiceFeedbackRepository;
import az.masapay.repository.RestaurantRepository;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.TransactionRepository;
import az.masapay.security.SecretCipher;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V30-V33 against a real PostgreSQL: the reservation entities match the schema, a reservation
 * payment has no order, the overlap query works, and the feedback native queries (which join
 * reservations and transactions.reservation_id) run. Skipped when Docker is absent.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(SecretCipher.class)
@TestPropertySource(properties = "masapay.security.allow-dev-secrets=true")
class ReservationPersistenceIntegrationTest {

	@Container
	@ServiceConnection
	static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private RestaurantRepository restaurantRepository;
	@Autowired
	private RestaurantTableRepository tableRepository;
	@Autowired
	private TransactionRepository transactionRepository;
	@Autowired
	private ReservationRepository reservationRepository;
	@Autowired
	private ServiceFeedbackRepository feedbackRepository;
	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void reservationsPrepaymentsAndFeedbackQueriesWork() {
		Restaurant restaurant = new Restaurant();
		restaurant.setName("Dolma");
		restaurant.getReservationRules().setDepositType(DepositType.FIXED);
		restaurant = restaurantRepository.saveAndFlush(restaurant);
		RestaurantTable table = new RestaurantTable();
		table.setRestaurant(restaurant);
		table.setLabel("C5");
		table.setLocationDescription("2nd floor, right side, cabin 5");
		table = tableRepository.saveAndFlush(table);
		assertThat(tableRepository.findByIdForUpdate(table.getId())).isPresent();

		Instant start = Instant.parse("2026-11-27T15:00:00Z");
		Reservation reservation = new Reservation();
		reservation.setRestaurant(restaurant);
		reservation.setTable(table);
		reservation.setCode("K7Q2M9XP3A");
		reservation.setGuestName("Aysel");
		reservation.setGuestPhone("+994501234567");
		reservation.setPartySize(2);
		reservation.setStartsAt(start);
		reservation.setEndsAt(start.plusSeconds(7200));
		reservation.setHoldMinutes(30);
		reservation.setFreeCancelUntil(start.minusSeconds(7200));
		// V34 guest requests round-trip (allergies stored as comma separated codes).
		reservation.setChildSeats(1);
		reservation.setWheelchairAccess(true);
		reservation.setOccasion(az.masapay.domain.enums.ReservationOccasion.BIRTHDAY);
		reservation.setAllergies(new java.util.ArrayList<>(java.util.List.of(
			az.masapay.domain.enums.Allergen.MILK, az.masapay.domain.enums.Allergen.NUTS)));
		reservation.setAllergyNote("Severe");
		reservation = reservationRepository.saveAndFlush(reservation);
		assertThat(jdbc.queryForObject("SELECT allergies FROM reservations WHERE id = ?", String.class,
			reservation.getId())).isEqualTo("NUTS,MILK");
		assertThat(reservationRepository.findSeatedWithClosedOrder()).isEmpty();
		assertThat(reservationRepository.findByOrderIdIn(java.util.List.of(java.util.UUID.randomUUID()))).isEmpty();

		assertThat(reservationRepository.findOverlapping(table.getId(), start.plusSeconds(3600),
			start.plusSeconds(9000), EnumSet.of(ReservationStatus.CONFIRMED, ReservationStatus.SEATED))).hasSize(1);
		assertThat(reservationRepository.findOverlapping(table.getId(), start.plusSeconds(7200),
			start.plusSeconds(9000), EnumSet.of(ReservationStatus.CONFIRMED))).isEmpty();
		assertThat(reservationRepository.findWithTableByCode("K7Q2M9XP3A")).isPresent();

		Transaction payment = new Transaction();
		payment.setReservation(reservation);
		payment.setRestaurant(restaurant);
		payment.setAmount(new BigDecimal("20.00"));
		payment.setTotalAmount(new BigDecimal("20.00"));
		payment.setSplitType(SplitType.RESERVATION);
		payment.setStatus(TransactionStatus.SUCCESS);
		payment = transactionRepository.saveAndFlush(payment);
		assertThat(transactionRepository.findByReservationIdAndStatusOrderByCreatedAtDesc(reservation.getId(),
			TransactionStatus.SUCCESS)).hasSize(1);

		assertThat(feedbackRepository.findReservationLink(payment.getId())).hasValueSatisfying(link ->
			assertThat(link.getTableId()).isEqualTo(tableRepository.findAll().get(0).getId()));

		ServiceFeedback feedback = new ServiceFeedback();
		feedback.setRestaurant(restaurant);
		feedback.setTable(table);
		feedback.setReservationId(reservation.getId());
		feedback.setTransaction(payment);
		feedback.setScore((short) 9);
		feedback.setAmountPaid(new BigDecimal("20.00"));
		feedbackRepository.saveAndFlush(feedback);

		Instant from = Instant.now().minusSeconds(3600);
		Instant to = Instant.now().plusSeconds(3600);
		assertThat(feedbackRepository.search(restaurant.getId(), from, to, 1, 10, 500)).singleElement()
			.satisfies(row -> {
				assertThat(row.getReservationCode()).isEqualTo("K7Q2M9XP3A");
				assertThat(row.getTableLabel()).isEqualTo("C5");
			});
		assertThat(feedbackRepository.stats(restaurant.getId(), from, to, 1, 10).getCount().longValue()).isEqualTo(1);

		// A transaction must pay a bill or a reservation.
		assertThatThrownBy(() -> jdbc.update("INSERT INTO transactions (restaurant_id, amount, total_amount) "
			+ "VALUES (?, 1, 1)", jdbc.queryForObject("SELECT id FROM restaurants LIMIT 1", java.util.UUID.class)))
			.isInstanceOf(DataIntegrityViolationException.class);
	}
}
