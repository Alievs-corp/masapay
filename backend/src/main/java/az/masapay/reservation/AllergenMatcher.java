package az.masapay.reservation;

import az.masapay.domain.MenuItem;
import az.masapay.domain.enums.Allergen;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Finds the allergens a dish probably contains from its name, description and ingredients
 * (spec section 11). Menus have no allergen column, so this is a keyword match in Azerbaijani,
 * English, Russian and Turkish: a hint for the guest, never a guarantee (the staff screens always
 * show the allergy itself). {@link Allergen#OTHER} never matches.
 *
 * <p>A keyword starting with {@code =} must be a whole word (so "egg" does not match "eggplant"
 * and "un" does not match "tuna"); every other keyword matches anywhere in a word, which covers
 * Russian and Azerbaijani endings ("орехами", "fındıqlı").
 */
public final class AllergenMatcher {

	private static final Map<Allergen, List<Pattern>> PATTERNS = new EnumMap<>(Allergen.class);

	static {
		add(Allergen.NUTS, "=nut", "=nuts", "walnut", "hazelnut", "almond", "cashew", "pistachio", "pecan",
			"macadamia", "praline", "nutella", "qoz", "fındıq", "findiq", "badam", "püstə", "puste", "fıstık",
			"ceviz", "орех", "миндал", "фундук", "фисташ", "кешью", "пекан");
		add(Allergen.PEANUTS, "peanut", "araxis", "yerfındığı", "yer fındığı", "yerfistigi", "yer fıstığı",
			"арахис");
		add(Allergen.MILK, "milk", "lactose", "cream", "butter", "cheese", "yogurt", "yoghurt", "mozzarella",
			"parmesan", "cheddar", "feta", "mascarpone", "ricotta", "=süd", "=sud", "südlü", "qaymaq", "pendir",
			"kərə yağı", "kere yagi", "qatıq", "qatiq", "ayran", "dovğa", "dovga", "=şor", "süt", "peynir",
			"tereyağ", "молок", "сливк", "сливоч", "сыр", "сметан", "йогурт", "творог", "лактоз", "кефир");
		add(Allergen.GLUTEN, "gluten", "wheat", "flour", "bread", "pasta", "spaghetti", "noodle", "barley",
			"=rye", "semolina", "couscous", "bulgur", "crouton", "breaded", "=un", "=unlu", "buğda", "bugda",
			"çörək", "corek", "makaron", "=arpa", "lavaş", "lavash", "xəmir", "xemir", "=yuxa", "qutab", "düşbərə",
			"dushbere", "ekmek", "глютен", "пшени", "мук", "хлеб", "макарон", "лапш", "ячмен", "манн",
			"булгур", "тесто");
		add(Allergen.EGGS, "=egg", "=eggs", "omelet", "omelette", "mayonnaise", "yumurta", "kuku", "mayonez",
			"яйц", "яич", "омлет", "майонез");
		add(Allergen.FISH, "fish", "salmon", "tuna", "=cod", "trout", "anchov", "sardine", "sturgeon", "caviar",
			"balıq", "baliq", "somon", "qızılbalıq", "qizilbaliq", "nərə balığı", "kürü", "balık",
			"рыб", "лосос", "тунец", "треск", "форел", "осетр", "икр", "анчоус", "сардин", "сёмг", "семг");
		add(Allergen.SHELLFISH, "shrimp", "prawn", "crab", "lobster", "mussel", "oyster", "=clam", "scallop",
			"squid", "calamari", "octopus", "seafood", "krevet", "karides", "xərçəng", "xerceng", "kalmar",
			"midye", "dəniz məhsul", "deniz mehsul", "креветк", "краб", "омар", "лобстер", "миди", "устриц",
			"кальмар", "осьминог", "морепродукт");
		add(Allergen.SOY, "=soy", "soya", "tofu", "edamame", "miso", "соя", "соев", "тофу");
		add(Allergen.SESAME, "sesame", "tahini", "küncüt", "kuncut", "susam", "tahin", "кунжут", "тахин");
	}

	private AllergenMatcher() {
	}

	private static void add(Allergen allergen, String... keywords) {
		List<Pattern> patterns = new ArrayList<>();
		for (String keyword : keywords) {
			boolean whole = keyword.startsWith("=");
			String word = Pattern.quote((whole ? keyword.substring(1) : keyword).toLowerCase(Locale.ROOT));
			String regex = whole ? "(?<![\\p{L}\\p{N}])" + word + "(?![\\p{L}\\p{N}])" : word;
			patterns.add(Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
		}
		PATTERNS.put(allergen, List.copyOf(patterns));
	}

	/** The asked allergens found in the text (in the fixed order); empty when none or no text. */
	public static List<Allergen> match(String text, Collection<Allergen> asked) {
		if (text == null || text.isBlank() || asked == null || asked.isEmpty()) {
			return List.of();
		}
		String lower = text.toLowerCase(Locale.ROOT);
		EnumSet<Allergen> found = EnumSet.noneOf(Allergen.class);
		for (Allergen allergen : asked) {
			List<Pattern> patterns = PATTERNS.get(allergen);
			if (patterns != null && patterns.stream().anyMatch(p -> p.matcher(lower).find())) {
				found.add(allergen);
			}
		}
		return List.copyOf(found);
	}

	/** The asked allergens a dish probably contains. */
	public static List<Allergen> match(MenuItem dish, Collection<Allergen> asked) {
		if (dish == null) {
			return List.of();
		}
		return match(textOf(dish.getName(), dish.getDescription(), dish.getIngredients()), asked);
	}

	/** Whether the dish has ingredients filled in, the only real allergen data a menu has. */
	public static boolean hasData(MenuItem dish) {
		return dish != null && dish.getIngredients() != null && !dish.getIngredients().isBlank();
	}

	static String textOf(String... parts) {
		StringBuilder text = new StringBuilder();
		for (String part : parts) {
			if (part != null) {
				text.append(part).append(' ');
			}
		}
		return text.toString();
	}
}
