import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { LIMITE_AUTH_POR_MINUTO, RELOJ, THROTTLER_AUTH } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ContrasenasService } from './contrasenas.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokensRepositorio } from './refresh-tokens.repositorio';
import { TokensService } from './tokens.service';

/** Autenticación (HU-01, ADR-004): JWT de acceso + refresh rotativo, guard global. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: THROTTLER_AUTH,
          ttl: 60_000,
          limit: Number(config.get('AUTH_LIMITE_POR_MINUTO') ?? LIMITE_AUTH_POR_MINUTO),
        },
      ],
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    AuthService,
    ContrasenasService,
    TokensService,
    UsuariosRepositorio,
    RefreshTokensRepositorio,
    { provide: RELOJ, useValue: () => new Date() },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokensService, UsuariosRepositorio, RELOJ],
})
export class AuthModule {}
