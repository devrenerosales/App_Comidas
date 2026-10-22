import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma compartido. La conexión es perezosa: si la base de datos no está
 * disponible al arrancar, la API sigue viva y el health check lo reporta.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(`Base de datos no disponible al iniciar: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.warn(
        `Error al cerrar la conexión a la base de datos: ${(error as Error).message}`,
      );
    }
  }
}
