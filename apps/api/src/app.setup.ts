import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import helmet from 'helmet';
import { crearErrorValidacion } from './comun/validacion';

export const PREFIJO_API = 'api/v1';

const PROXY_POR_DEFECTO = 'loopback, linklocal, uniquelocal';

/** "1" → 1 salto; "true"/"false" → booleano; cualquier otro texto → lista de rangos de Express. */
export function confianzaProxy(valor?: string): string | number | boolean {
  const v = valor?.trim();
  if (!v) return PROXY_POR_DEFECTO;
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

/** Configuración HTTP común a main.ts y a las pruebas e2e. */
export function configurarApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);
  app.setGlobalPrefix(PREFIJO_API);
  // Detrás de Caddy (red privada de Docker): req.ip toma X-Forwarded-For para el throttling.
  // Con TRUST_PROXY (p. ej. "1" en Vercel) se confía en ese número de saltos.
  const servidor = app.getHttpAdapter().getInstance() as Partial<Express>;
  servidor.set?.('trust proxy', confianzaProxy(config.get<string>('TRUST_PROXY')));
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
