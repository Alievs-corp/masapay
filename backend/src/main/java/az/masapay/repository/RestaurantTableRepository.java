package az.masapay.repository;

import az.masapay.domain.Restaurant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import az.masapay.domain.RestaurantTable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, UUID> {

	/** Resolve a table from the token embedded in its QR code (customer PWA, EPIC 4). */
	Optional<RestaurantTable> findByQrToken(UUID qrToken);

	/** The restaurant behind a QR code, fully loaded, for checks made outside a transaction (#147). */
	@Query("SELECT t.restaurant FROM RestaurantTable t WHERE t.qrToken = :qrToken")
	Optional<Restaurant> findRestaurantByQrToken(@Param("qrToken") UUID qrToken);

	List<RestaurantTable> findByRestaurantId(UUID restaurantId);

	/**
	 * The table row-locked ({@code SELECT ... FOR UPDATE}) until the transaction ends, so two
	 * bookings of the same table are checked for overlap one after the other.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT t FROM RestaurantTable t WHERE t.id = :id")
	Optional<RestaurantTable> findByIdForUpdate(@Param("id") UUID id);

	/** Tables of a restaurant in label order, for the bulk QR export (#47). */
	List<RestaurantTable> findByRestaurantIdOrderByLabelAsc(UUID restaurantId);
}
