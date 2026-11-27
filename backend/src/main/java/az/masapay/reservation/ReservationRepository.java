package az.masapay.reservation;

import az.masapay.domain.enums.ReservationStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

	Optional<Reservation> findByCode(String code);

	boolean existsByCode(String code);

	/** By code with its table and restaurant loaded, for use outside a transaction (checkout). */
	@Query("SELECT r FROM Reservation r JOIN FETCH r.table JOIN FETCH r.restaurant WHERE r.code = :code")
	Optional<Reservation> findWithTableByCode(@Param("code") String code);

	Optional<Reservation> findByIdAndRestaurantId(UUID id, UUID restaurantId);

	/** Active bookings of a table that overlap {@code [from, to)}. */
	@Query("SELECT r FROM Reservation r WHERE r.table.id = :tableId AND r.status IN :statuses "
		+ "AND r.startsAt < :to AND r.endsAt > :from")
	List<Reservation> findOverlapping(@Param("tableId") UUID tableId, @Param("from") Instant from,
		@Param("to") Instant to, @Param("statuses") Collection<ReservationStatus> statuses);

	/** A restaurant's bookings that overlap {@code [from, to)} in the given statuses, by start time. */
	@Query("SELECT r FROM Reservation r WHERE r.restaurant.id = :restaurantId AND r.status IN :statuses "
		+ "AND r.startsAt < :to AND r.endsAt > :from ORDER BY r.startsAt ASC")
	List<Reservation> findByRestaurantInRange(@Param("restaurantId") UUID restaurantId, @Param("from") Instant from,
		@Param("to") Instant to, @Param("statuses") Collection<ReservationStatus> statuses);

	/** All bookings of a restaurant starting in {@code [from, to)}, by start time (staff day list). */
	List<Reservation> findByRestaurantIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAsc(
		UUID restaurantId, Instant from, Instant to);

	/** CONFIRMED bookings whose start was before {@code startedBefore} (expiry candidates). */
	List<Reservation> findByStatusAndStartsAtBefore(ReservationStatus status, Instant startedBefore);

	/** The reservation that joined a bill. */
	Optional<Reservation> findFirstByOrderId(UUID orderId);

	List<Reservation> findByOrderIdAndStatus(UUID orderId, ReservationStatus status);

	/** The reservations that joined these bills (kitchen allergy warnings). */
	List<Reservation> findByOrderIdIn(Collection<UUID> orderIds);

	/** SEATED bookings whose bill was cancelled or closed without the paid event (to complete). */
	@Query("SELECT r FROM Reservation r WHERE r.status = az.masapay.domain.enums.ReservationStatus.SEATED "
		+ "AND r.order IS NOT NULL AND r.order.status <> az.masapay.domain.enums.OrderStatus.OPEN")
	List<Reservation> findSeatedWithClosedOrder();
}
