package az.masapay.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PrehashedBCryptPasswordEncoderTest {

	private final PrehashedBCryptPasswordEncoder encoder = new PrehashedBCryptPasswordEncoder(4);

	@Test
	void aHashMatchesOnlyItsOwnPassword() {
		String hash = encoder.encode("correct horse battery");

		assertThat(hash).startsWith("$2a$04$").doesNotContain("correct");
		assertThat(encoder.matches("correct horse battery", hash)).isTrue();
		assertThat(encoder.matches("correct horse batterz", hash)).isFalse();
	}

	@Test
	void everyCharacterOfALongPasswordCounts() {
		String base = "ə".repeat(100);
		String hash = encoder.encode(base + "a");

		// Far beyond BCrypt's 72 bytes, yet the last character still decides.
		assertThat(encoder.matches(base + "a", hash)).isTrue();
		assertThat(encoder.matches(base + "b", hash)).isFalse();
	}

	@Test
	void aMissingHashNeverMatches() {
		assertThat(encoder.matches("anything", null)).isFalse();
		assertThat(encoder.matches("anything", "")).isFalse();
		assertThat(encoder.matches(null, encoder.encode("anything"))).isFalse();
	}
}
