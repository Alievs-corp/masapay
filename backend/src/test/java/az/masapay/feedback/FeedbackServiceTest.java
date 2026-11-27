package az.masapay.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.masapay.domain.Order;
import az.masapay.domain.Restaurant;
import az.masapay.domain.RestaurantTable;
import az.masapay.domain.Transaction;
import az.masapay.domain.User;
import az.masapay.domain.enums.TransactionStatus;
import az.masapay.domain.enums.UserRole;
import az.masapay.feedback.dto.FeedbackList;
import az.masapay.feedback.dto.FeedbackSubmitRequest;
import az.masapay.feedback.dto.FeedbackView;
import az.masapay.repository.RestaurantTableRepository;
import az.masapay.repository.TransactionRepository;
import az.masapay.repository.UserRepository;
import az.masapay.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

	@Mock
	private ServiceFeedbackRepository feedbackRepository;

	@Mock
	private TransactionRepository transactionRepository;

	@Mock
	private RestaurantTableRepository tableRepository;

	@Mock
	private UserRepository userRepository;

	private FeedbackService service;

	private final UUID restaurantId = UUID.randomUUID();
	private final Restaurant restaurant = new Restaurant();
	private final RestaurantTable table = new RestaurantTable();
	private final Order order = new Order();
	private final Transaction tx = new Transaction();
	private final AuthenticatedUser admin =
		new AuthenticatedUser(UUID.randomUUID(), "admin@example.com", UserRole.SUPER_ADMIN);

	@BeforeEach
	void setUp() {
		// 2026-10-31T21:30Z is already 2026-11-01 01:30 in Baku (UTC+4).
		Clock clock = Clock.fixed(Instant.parse("2026-10-31T21:30:00Z"), ZoneOffset.UTC);
		service = new FeedbackService(feedbackRepository, transactionRepository, tableRepository, userRepository,
			clock);
		restaurant.setId(restaurantId);
		table.setId(UUID.randomUUID());
		order.setId(UUID.randomUUID());
		order.setTable(table);
		tx.setId(UUID.randomUUID());
		tx.setRestaurant(restaurant);
		tx.setOrder(order);
		tx.setStatus(TransactionStatus.SUCCESS);
		tx.setTotalAmount(new BigDecimal("42.50"));
		tx.setCurrency("AZN");
	}

	private void stubSave() {
		when(feedbackRepository.saveAndFlush(any(ServiceFeedback.class))).thenAnswer(inv -> {
			ServiceFeedback saved = inv.getArgument(0);
			saved.setId(UUID.randomUUID());
			return saved;
		});
	}

	private static ResponseStatusException error(Runnable call) {
		try {
			call.run();
		} catch (ResponseStatusException e) {
			return e;
		}
		throw new AssertionError("expected ResponseStatusException");
	}

	@Test
	void lowScoreWithoutNoteIsRejected() {
		for (int score = 1; score <= 6; score++) {
			int s = score;
			ResponseStatusException e = error(() -> service.submit(new FeedbackSubmitRequest(tx.getId(), s, "   ")));
			assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
			assertThat(e.getReason()).isEqualTo(FeedbackService.NOTE_REQUIRED);
		}
		verifyNoInteractions(transactionRepository);
	}

	@Test
	void lowScoreWithNoteIsSavedForTheTableBill() {
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
		when(feedbackRepository.findReservationLink(tx.getId())).thenReturn(Optional.empty());
		stubSave();

		FeedbackView view = service.submit(new FeedbackSubmitRequest(tx.getId(), 4, "  Waited 30 minutes "));

		ArgumentCaptor<ServiceFeedback> saved = ArgumentCaptor.forClass(ServiceFeedback.class);
		verify(feedbackRepository).saveAndFlush(saved.capture());
		ServiceFeedback f = saved.getValue();
		assertThat(f.getScore()).isEqualTo((short) 4);
		assertThat(f.getNote()).isEqualTo("Waited 30 minutes");
		assertThat(f.getRestaurant()).isSameAs(restaurant);
		assertThat(f.getTable()).isSameAs(table);
		assertThat(f.getOrder()).isSameAs(order);
		assertThat(f.getReservationId()).isNull();
		assertThat(f.getAmountPaid()).isEqualByComparingTo("42.50");
		assertThat(view.score()).isEqualTo(4);
		assertThat(view.note()).isEqualTo("Waited 30 minutes");
		assertThat(view.createdAt()).isNotNull();
	}

	@Test
	void highScoreNoteIsOptional() {
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
		when(feedbackRepository.findReservationLink(tx.getId())).thenReturn(Optional.empty());
		stubSave();

		FeedbackView view = service.submit(new FeedbackSubmitRequest(tx.getId(), 7, null));

		assertThat(view.score()).isEqualTo(7);
		assertThat(view.note()).isNull();
	}

	@Test
	void reservationPaymentIsLinkedToTheReservationAndItsTable() {
		tx.setOrder(null);
		UUID reservationId = UUID.randomUUID();
		UUID reservedTableId = UUID.randomUUID();
		RestaurantTable reserved = new RestaurantTable();
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
		when(feedbackRepository.findReservationLink(tx.getId())).thenReturn(Optional.of(
			new ServiceFeedbackRepository.ReservationLink() {
				public UUID getReservationId() {
					return reservationId;
				}

				public UUID getTableId() {
					return reservedTableId;
				}
			}));
		when(tableRepository.getReferenceById(reservedTableId)).thenReturn(reserved);
		stubSave();

		service.submit(new FeedbackSubmitRequest(tx.getId(), 10, null));

		ArgumentCaptor<ServiceFeedback> saved = ArgumentCaptor.forClass(ServiceFeedback.class);
		verify(feedbackRepository).saveAndFlush(saved.capture());
		assertThat(saved.getValue().getReservationId()).isEqualTo(reservationId);
		assertThat(saved.getValue().getTable()).isSameAs(reserved);
		assertThat(saved.getValue().getOrder()).isNull();
	}

	@Test
	void unsuccessfulPaymentIsRejected() {
		tx.setStatus(TransactionStatus.PENDING);
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));

		ResponseStatusException e = error(() -> service.submit(new FeedbackSubmitRequest(tx.getId(), 9, null)));

		assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(e.getReason()).isEqualTo(FeedbackService.PAYMENT_NOT_SUCCESSFUL);
		verify(feedbackRepository, never()).saveAndFlush(any());
	}

	@Test
	void secondFeedbackForTheSamePaymentIsRejected() {
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
		when(feedbackRepository.existsByTransactionId(tx.getId())).thenReturn(true);

		ResponseStatusException e = error(() -> service.submit(new FeedbackSubmitRequest(tx.getId(), 9, null)));

		assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(e.getReason()).isEqualTo(FeedbackService.FEEDBACK_EXISTS);
	}

	@Test
	void concurrentDuplicateHitsTheUniqueConstraint() {
		when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
		when(feedbackRepository.findReservationLink(tx.getId())).thenReturn(Optional.empty());
		when(feedbackRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("dup"));

		ResponseStatusException e = error(() -> service.submit(new FeedbackSubmitRequest(tx.getId(), 8, null)));

		assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(e.getReason()).isEqualTo(FeedbackService.FEEDBACK_EXISTS);
	}

	@Test
	void unknownPaymentIs404() {
		UUID unknown = UUID.randomUUID();
		when(transactionRepository.findById(unknown)).thenReturn(Optional.empty());

		ResponseStatusException e = error(() -> service.submit(new FeedbackSubmitRequest(unknown, 8, null)));

		assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
	}

	@Test
	void listReturnsAverageOutOfTenAndUsesBakuDays() {
		when(feedbackRepository.stats(eq(restaurantId), any(), any(), eq(1), eq(10)))
			.thenReturn(stats(3, new BigDecimal("8.3333333")));
		ServiceFeedbackRepository.FeedbackRow row = row(9, null, UUID.randomUUID(), "R-ABC123");
		when(feedbackRepository.search(eq(restaurantId), any(), any(), eq(1), eq(10), anyInt()))
			.thenReturn(List.of(row));

		FeedbackList list = service.list(admin, restaurantId, null, null, null, null);

		assertThat(list.averageScore()).isEqualByComparingTo("8.3");
		assertThat(list.count()).isEqualTo(3);
		assertThat(list.items()).hasSize(1);
		assertThat(list.items().get(0).kind()).isEqualTo("RESERVATION");
		assertThat(list.items().get(0).reservationCode()).isEqualTo("R-ABC123");
		assertThat(list.items().get(0).score()).isEqualTo(9);
		// Today in Baku is 2026-11-01, so the default 30 days are 2026-10-03 .. 2026-11-01 inclusive.
		verify(feedbackRepository).stats(restaurantId, Instant.parse("2026-10-02T20:00:00Z"),
			Instant.parse("2026-11-01T20:00:00Z"), 1, 10);
	}

	@Test
	void emptyListHasNoAverage() {
		when(feedbackRepository.stats(eq(restaurantId), any(), any(), eq(1), eq(6))).thenReturn(stats(0, null));
		when(feedbackRepository.search(eq(restaurantId), any(), any(), eq(1), eq(6), anyInt())).thenReturn(List.of());

		FeedbackList list = service.list(admin, restaurantId, LocalDate.of(2026, 10, 1),
			LocalDate.of(2026, 10, 31), 1, 6);

		assertThat(list.averageScore()).isNull();
		assertThat(list.count()).isZero();
		verify(feedbackRepository).stats(restaurantId, Instant.parse("2026-09-30T20:00:00Z"),
			Instant.parse("2026-10-31T20:00:00Z"), 1, 6);
	}

	@Test
	void invalidFiltersAreRejected() {
		assertThatThrownBy(() -> service.list(admin, restaurantId, LocalDate.of(2026, 10, 5),
			LocalDate.of(2026, 10, 1), null, null)).isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> service.list(admin, restaurantId, null, null, 8, 3))
			.isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> service.list(admin, restaurantId, null, null, 0, 10))
			.isInstanceOf(ResponseStatusException.class);
	}

	@Test
	void managerOfAnotherRestaurantIsForbidden() {
		AuthenticatedUser manager = new AuthenticatedUser(UUID.randomUUID(), "m@example.com", UserRole.RESTO_MANAGER);
		Restaurant other = new Restaurant();
		other.setId(UUID.randomUUID());
		User user = new User();
		user.setRestaurant(other);
		when(userRepository.findById(manager.id())).thenReturn(Optional.of(user));

		ResponseStatusException e = error(() -> service.list(manager, restaurantId, null, null, null, null));

		assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
		verify(feedbackRepository, never()).stats(any(), any(), any(), anyInt(), anyInt());
	}

	@Test
	void managerOfOwnRestaurantMayRead() {
		AuthenticatedUser manager = new AuthenticatedUser(UUID.randomUUID(), "m@example.com", UserRole.RESTO_MANAGER);
		User user = new User();
		user.setRestaurant(restaurant);
		when(userRepository.findById(manager.id())).thenReturn(Optional.of(user));
		when(feedbackRepository.stats(eq(restaurantId), any(), any(), anyInt(), anyInt())).thenReturn(stats(0, null));
		when(feedbackRepository.search(eq(restaurantId), any(), any(), anyInt(), anyInt(), anyInt()))
			.thenReturn(List.of());

		assertThat(service.list(manager, restaurantId, null, null, null, null).count()).isZero();
	}

	private static ServiceFeedbackRepository.FeedbackStats stats(long count, BigDecimal average) {
		return new ServiceFeedbackRepository.FeedbackStats() {
			public Number getCount() {
				return count;
			}

			public Number getAverage() {
				return average;
			}
		};
	}

	private static ServiceFeedbackRepository.FeedbackRow row(int score, String note, UUID reservationId,
		String code) {
		return new ServiceFeedbackRepository.FeedbackRow() {
			public UUID getId() {
				return UUID.randomUUID();
			}

			public Number getScore() {
				return (short) score;
			}

			public String getNote() {
				return note;
			}

			public String getTableLabel() {
				return "T3";
			}

			public String getReservationCode() {
				return code;
			}

			public UUID getReservationId() {
				return reservationId;
			}

			public BigDecimal getAmountPaid() {
				return new BigDecimal("42.50");
			}

			public String getCurrency() {
				return "AZN";
			}

			public Instant getCreatedAt() {
				return Instant.parse("2026-10-31T10:00:00Z");
			}
		};
	}
}
