import { Inject, Injectable } from '@nestjs/common';
import { sql, type Db } from '@menu/db';
import type Redis from 'ioredis';
import { DB } from '../database/database.constants';
import { REDIS_CLIENT } from '../redis/redis.constants';

export type EstadoDependencia = 'up' | 'down';

export interface ChequeoDependencia {
  status: EstadoDependencia;
  latencyMs: number;
  error?: string;
}

export interface ReporteSalud {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSec: number;
  version: string;
  checks: {
    database: ChequeoDependencia;
    redis: ChequeoDependencia;
  };
}

export const TIMEOUT_CHEQUEO_MS = 2000;

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`timeout ${ms} ms`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async reporte(): Promise<ReporteSalud> {
    const [database, redis] = await Promise.all([this.chequearBd(), this.chequearRedis()]);
    const todoArriba = database.status === 'up' && redis.status === 'up';
    return {
      status: todoArriba ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
      checks: { database, redis },
    };
  }

  /** `select 1` contra PostgreSQL; el timeout de `medir` evita colgar el health check. */
  chequearBd(): Promise<ChequeoDependencia> {
    return this.medir(() => this.db.execute(sql`select 1`));
  }

  chequearRedis(): Promise<ChequeoDependencia> {
    return this.medir(async () => {
      if (this.redis.status === 'wait' || this.redis.status === 'end') {
        await this.redis.connect();
      }
      return this.redis.ping();
    });
  }

  private async medir(fn: () => Promise<unknown>): Promise<ChequeoDependencia> {
    const inicio = Date.now();
    try {
      await conTimeout(fn(), TIMEOUT_CHEQUEO_MS);
      return { status: 'up', latencyMs: Date.now() - inicio };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - inicio,
        error: error instanceof Error ? error.message.split('\n')[0] : String(error),
      };
    }
  }
}
