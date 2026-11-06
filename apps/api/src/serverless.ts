import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import { limpiarUrl } from './serverless.url';

/** Servidor Express de la API (el que Nest monta por dentro), sin escuchar en ningún puerto. */
export type Servidor = (req: IncomingMessage, res: ServerResponse) => void;

let pendiente: Promise<Servidor> | null = null;
let aplicacion: INestApplication | null = null;

async function crear(): Promise<Servidor> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configurarApp(app);
  await app.init();
  aplicacion = app;
  return app.getHttpAdapter().getInstance() as Servidor;
}

/**
 * Crea la aplicación una sola vez por instancia de la función: las peticiones siguientes la
 * reutilizan (arranque en frío solo la primera). Si el arranque falla se descarta para reintentar.
 */
export function obtenerServidor(): Promise<Servidor> {
  pendiente ??= crear().catch((error: unknown) => {
    pendiente = null;
    throw error;
  });
  return pendiente;
}

/** Cierra la aplicación y descarta la instancia (pruebas; la función serverless no lo necesita). */
export async function cerrarServidor(): Promise<void> {
  const app = aplicacion;
  pendiente = null;
  aplicacion = null;
  await app?.close();
}

/**
 * Punto de entrada para funciones serverless (Vercel): `api/index.js` lo exporta tal cual.
 * Despliegue sin servidor persistente; ver docs/02-diseno/despliegue-vercel-supabase.md.
 */
export default async function manejador(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const servidor = await obtenerServidor();
    // Quita el `?path=…` que Vercel agrega por la reescritura (ver serverless.url.ts).
    req.url = limpiarUrl(req.url ?? '/');
    // Los ayudantes de Vercel dejan `req.query` ya calculado (con ese `path`) y Express solo lo
    // calcula si no existe: se descarta para que se vuelva a leer de la dirección limpia.
    delete (req as { query?: unknown }).query;
    servidor(req, res);
  } catch (error) {
    console.error('La API no pudo iniciar', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/problem+json');
    res.end(
      JSON.stringify({
        type: 'about:blank',
        title: 'Error interno',
        status: 500,
        code: 'ERROR_INICIO',
        detail: 'La API no pudo iniciar. Revisa las variables de entorno del despliegue.',
      }),
    );
  }
}
