import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import helmet from 'helmet';
import { crearErrorValidacion } from './comun/validacion';

export const PREFIJO_API = 'api/v1';

/** Configuración HTTP común a main.ts y a las pruebas e2e. */
export function configurarApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);
  app.setGlobalPrefix(PREFIJO_API);
  // Detrás de Caddy (red privada de Docker): req.ip toma X-Forwarded-For para el throttling.
  const servidor = app.getHttpAdapter().getInstance() as Partial<Express>;
  servidor.set?.('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: crearErrorValidacion,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
