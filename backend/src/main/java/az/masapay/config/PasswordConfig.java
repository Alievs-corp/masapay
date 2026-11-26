package az.masapay.config;

import az.masapay.security.PrehashedBCryptPasswordEncoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Hashes account passwords with BCrypt (cost 12, about a quarter of a second per check). */
@Configuration
public class PasswordConfig {

	static final int BCRYPT_STRENGTH = 12;

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new PrehashedBCryptPasswordEncoder(BCRYPT_STRENGTH);
	}
}
