package az.masapay.reservation;

import az.masapay.domain.enums.Allergen;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Stores a reservation's allergies as comma separated codes ("NUTS,MILK"), in the fixed order of
 * {@link Allergen}; an unknown code read back (a removed value) is skipped.
 */
@Converter
public class AllergenListConverter implements AttributeConverter<List<Allergen>, String> {

	@Override
	public String convertToDatabaseColumn(List<Allergen> allergens) {
		if (allergens == null || allergens.isEmpty()) {
			return "";
		}
		return EnumSet.copyOf(allergens).stream().map(Enum::name).collect(Collectors.joining(","));
	}

	@Override
	public List<Allergen> convertToEntityAttribute(String value) {
		if (value == null || value.isBlank()) {
			return new ArrayList<>();
		}
		Set<Allergen> found = EnumSet.noneOf(Allergen.class);
		Arrays.stream(value.split(",")).map(String::strip).forEach(code -> {
			try {
				found.add(Allergen.valueOf(code));
			} catch (IllegalArgumentException ignored) {
				// a code no longer in the list
			}
		});
		return new ArrayList<>(found);
	}
}
