const PG_URL = /^postgres(ql)?:\/\//i;

function looksLikePostgresUrl(url: string): boolean {
  return PG_URL.test(url.trim());
}

/**
 * Reject SQLite file URLs and non-Postgres schemes whenever DB vars are set.
 * Prisma schema uses provider postgresql only; a `file:` URL always indicates a stale or wrong .env.
 */
export function assertPostgresDatabaseUrls(): void {
  const db = process.env.DATABASE_URL?.trim();
  const direct = process.env.DIRECT_URL?.trim();
  if (db?.startsWith('file:')) {
    throw new Error(
      'DATABASE_URL uses file: (SQLite). Use postgresql://... only. In production, set variables in Railway and do not rely on a local .env.',
    );
  }
  if (direct?.startsWith('file:')) {
    throw new Error('DIRECT_URL cannot use file:; use postgresql://... (direct Postgres, port 5432 for Supabase).');
  }
  if (db && !looksLikePostgresUrl(db)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL (postgresql:// or postgres://).');
  }
  if (direct && !looksLikePostgresUrl(direct)) {
    throw new Error('DIRECT_URL must be a PostgreSQL URL (postgresql:// or postgres://).');
  }
}

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

  if (!looksLikePostgresUrl(process.env.DATABASE_URL!)) {
    throw new Error('Production DATABASE_URL must start with postgresql:// or postgres://');
  }
  if (!looksLikePostgresUrl(process.env.DIRECT_URL!)) {
    throw new Error('Production DIRECT_URL must start with postgresql:// or postgres://');
  }
}
