/**
 * Fail fast in production when required secrets or URLs are missing.
 * Railway / Supabase: set DATABASE_URL + DIRECT_URL (see .env.example).
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt || jwt.length < 24) {
    throw new Error(
      'Production requires JWT_SECRET (at least 24 characters). Generate a strong random value.',
    );
  }
  if (jwt === 'dev_secret_change_me' || jwt === 'replace-with-a-long-random-string') {
    throw new Error('Production requires a unique JWT_SECRET; do not use the example placeholder.');
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('Production requires DATABASE_URL (PostgreSQL connection string).');
  }
  if (!process.env.DIRECT_URL?.trim()) {
    throw new Error(
      'Production requires DIRECT_URL. Use the same value as DATABASE_URL unless you use Supabase Transaction pooler (then DIRECT_URL = direct port 5432).',
    );
  }
}
