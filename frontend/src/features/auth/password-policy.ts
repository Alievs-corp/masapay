// The password policy, the same as the backend's (@ValidPassword): 10 to 128
// characters. Checked here too, so a form can say what is wrong before sending.
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  )
}
