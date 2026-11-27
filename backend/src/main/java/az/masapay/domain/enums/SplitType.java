package az.masapay.domain.enums;

/** Bill-splitting mode that produced a payment (EPIC 5). Matches transactions.split_type. */
public enum SplitType {
	FULL,
	ITEM,
	EQUAL,
	/** Prepayment of a reservation (deposit or pre-ordered dishes). */
	RESERVATION
}
