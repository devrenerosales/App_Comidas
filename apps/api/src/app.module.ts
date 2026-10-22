import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { ProblemaFiltro } from './comun/problema.filter';
import { CorreoModule } from './correo/correo.module';
import { validarEntorno } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { HogarModule } from './hogar/hogar.module';
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
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
          },
        };
      },
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CorreoModule,
    HogarModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemaFiltro }],
})
export class AppModule {}
