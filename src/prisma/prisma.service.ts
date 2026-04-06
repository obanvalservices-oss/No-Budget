// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** PgBouncer / Supavisor transaction pool: prepared statements are invalid across pooled sessions. */
function runtimeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return raw;
  const poolerLike =
    /pooler\.supabase\.com/i.test(raw) || /:6543(\/|\?|$)/.test(raw);
  if (!poolerLike) return raw;
  let url = raw;
  if (!/[?&]pgbouncer=true(?:&|$)/i.test(url)) {
    url += url.includes('?') ? '&' : '?';
    url += 'pgbouncer=true';
  }
  if (!/[?&]connection_limit=\d+(?:&|$)/i.test(url)) {
    url += url.includes('?') ? '&' : '?';
    url += 'connection_limit=1';
  }
  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = runtimeDatabaseUrl(process.env.DATABASE_URL);
    super(
      url
        ? {
            datasources: {
              db: { url },
            },
          }
        : {},
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
