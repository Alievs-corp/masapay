package az.masapay.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import az.masapay.domain.MenuItem;
import az.masapay.domain.enums.Allergen;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.Test;

class AllergenMatcherTest {

	private static final EnumSet<Allergen> ALL = EnumSet.allOf(Allergen.class);

	@Test
	void findsAllergensInAzerbaijaniEnglishAndRussian() {
		assertThat(AllergenMatcher.match("Paxlava: un, qoz, kərə yağı", ALL))
			.containsExactly(Allergen.NUTS, Allergen.MILK, Allergen.GLUTEN);
		assertThat(AllergenMatcher.match("Shrimp pasta with parmesan", ALL))
			.containsExactly(Allergen.MILK, Allergen.GLUTEN, Allergen.SHELLFISH);
		assertThat(AllergenMatcher.match("Салат с орехами и кунжутом", ALL))
			.containsExactly(Allergen.NUTS, Allergen.SESAME);
		assertThat(AllergenMatcher.match("Qızılbalıq, yumurta", ALL)).containsExactly(Allergen.EGGS, Allergen.FISH);
	}

	@Test
	void shortKeywordsMustBeWholeWords() {
		// "egg" in eggplant, "un" in tuna, "nut" in donut are not allergens.
		assertThat(AllergenMatcher.match("Grilled eggplant", EnumSet.of(Allergen.EGGS))).isEmpty();
		assertThat(AllergenMatcher.match("Donut", EnumSet.of(Allergen.NUTS))).isEmpty();
		assertThat(AllergenMatcher.match("Soğan, un", EnumSet.of(Allergen.GLUTEN))).containsExactly(Allergen.GLUTEN);
	}

	@Test
	void onlyTheAskedAllergensAreReportedAndOtherNeverMatches() {
		assertThat(AllergenMatcher.match("Peanut butter cookie", EnumSet.of(Allergen.PEANUTS)))
			.containsExactly(Allergen.PEANUTS);
		assertThat(AllergenMatcher.match("Anything at all", EnumSet.of(Allergen.OTHER))).isEmpty();
		assertThat(AllergenMatcher.match((String) null, ALL)).isEmpty();
		assertThat(AllergenMatcher.match("Milk", List.of())).isEmpty();
	}

	@Test
	void aDishIsMatchedOnNameDescriptionAndIngredients() {
		MenuItem dish = new MenuItem();
		dish.setName("Səhər yeməyi");
		dish.setDescription("Pendir və çörək ilə");
		assertThat(AllergenMatcher.match(dish, ALL)).containsExactly(Allergen.MILK, Allergen.GLUTEN);
		assertThat(AllergenMatcher.hasData(dish)).isFalse();
		dish.setIngredients("soya sousu");
		assertThat(AllergenMatcher.match(dish, EnumSet.of(Allergen.SOY))).containsExactly(Allergen.SOY);
		assertThat(AllergenMatcher.hasData(dish)).isTrue();
	}

	@Test
	void theStoredListRoundTrips() {
		AllergenListConverter converter = new AllergenListConverter();
		assertThat(converter.convertToDatabaseColumn(List.of(Allergen.MILK, Allergen.NUTS))).isEqualTo("NUTS,MILK");
		assertThat(converter.convertToDatabaseColumn(List.of())).isEmpty();
		assertThat(converter.convertToEntityAttribute("NUTS,MILK,REMOVED")).containsExactly(Allergen.NUTS,
			Allergen.MILK);
		assertThat(converter.convertToEntityAttribute("")).isEmpty();
	}
}
