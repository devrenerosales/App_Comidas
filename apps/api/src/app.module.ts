import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validarEntorno } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validarEntorno,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const entorno = config.get<string>('NODE_ENV');
        return {
          pinoHttp: {
            // Logs JSON estructurados; en test se silencian.
            level: entorno === 'test' ? 'silent' : entorno === 'production' ? 'info' : 'debug',
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
          },
        };
      },
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
