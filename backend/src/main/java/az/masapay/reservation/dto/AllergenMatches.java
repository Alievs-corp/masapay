package az.masapay.reservation.dto;

import az.masapay.domain.enums.Allergen;
import java.util.List;
import java.util.UUID;

/**
 * Which dishes of the menu match the asked allergens. {@code hasAllergenData} is false when no dish
 * shown that day has ingredients filled in, so the guest page relies on the restaurant being told.
 */
public record AllergenMatches(boolean hasAllergenData, List<Match> matches) {

	public record Match(UUID menuItemId, List<Allergen> allergens) {
	}
}
