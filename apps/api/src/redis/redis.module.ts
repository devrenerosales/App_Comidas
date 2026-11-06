import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL');
        // Sin REDIS_URL (despliegue sin Redis) la API arranca igual y el health lo reporta "disabled".
        if (!url) return null;
        return new Redis(url, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (intentos) => Math.min(intentos * 500, 5000),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  onApplicationShutdown(): void {
    this.redis?.disconnect();
  }
}
