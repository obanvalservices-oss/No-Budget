import { config } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertPostgresDatabaseUrls, validateProductionEnv } from './config/validate-env';

// Local/dev only: never load `.env` in production (Railway/Docker inject vars). Avoids a stray `file:` URL winning over the platform.
if (process.env.NODE_ENV !== 'production') {
  config();
}
assertPostgresDatabaseUrls();
validateProductionEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.NODE_ENV === 'production') {
    const http = app.getHttpAdapter().getInstance();
    if (typeof http?.set === 'function') {
      http.set('trust proxy', 1);
    }
  }

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const corsRaw = process.env.CORS_ORIGIN?.trim();
  const corsOrigins = corsRaw
    ? corsRaw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : null;

  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`> http://localhost:${port}/  (API /api)`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
