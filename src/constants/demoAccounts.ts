export const DEMO_ALLOWED_EMAILS = [
  'isabella.rocha@nera.com.br'
];

/**
 * Checks if a given email is part of the authorized demo accounts list.
 * Performs a case-insensitive, trimmed comparison.
 */
export function isDemoEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return DEMO_ALLOWED_EMAILS.some(
    (demoEmail) => demoEmail.toLowerCase().trim() === normalizedEmail
  );
}
