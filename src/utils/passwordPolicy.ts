export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SYMBOL_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export type PasswordRules = {
  minLength: boolean;
  hasUpperLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
};

export function getPasswordRules(password: string): PasswordRules {
  const value = typeof password === 'string' ? password : '';
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    hasUpperLower: /[a-z]/.test(value) && /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSymbol: PASSWORD_SYMBOL_REGEX.test(value),
  };
}

export function isPasswordStrong(password: string): boolean {
  const rules = getPasswordRules(password);
  return Object.values(rules).every(Boolean);
}

export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener 8–128 caracteres, mayúsculas y minúsculas, un número y un símbolo (!@#$%^&*).';
