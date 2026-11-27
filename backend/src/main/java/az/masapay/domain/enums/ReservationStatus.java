package az.masapay.domain.enums;

/** Life cycle of a reservation. Matches reservations.status. */
public enum ReservationStatus {
	CONFIRMED,
	SEATED,
	COMPLETED,
	CANCELLED,
	NO_SHOW;

	/** Holds the table: overlaps are checked against these. */
	public boolean isActive() {
		return this == CONFIRMED || this == SEATED;
	}
}
