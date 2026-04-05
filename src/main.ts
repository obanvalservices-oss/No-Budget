import { config } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateProductionEnv } from './config/validate-env';

// Carga `.env` del directorio de trabajo (Nest corre desde la raíz del proyecto). Necesario para TWELVE_DATA_API_KEY, etc.
config();
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

bootstrap();
