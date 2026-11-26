package az.masapay.auth;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The password policy, the same wherever a password is set: 10 to 128 characters. A request
 * that breaks it is answered 400 with "{field}: must be 10 to 128 characters".
 */
@Documented
@NotNull
@Size(min = ValidPassword.MIN_LENGTH, max = ValidPassword.MAX_LENGTH)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPassword {

	int MIN_LENGTH = 10;
	int MAX_LENGTH = 128;

	String message() default "must be " + MIN_LENGTH + " to " + MAX_LENGTH + " characters";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};
}
