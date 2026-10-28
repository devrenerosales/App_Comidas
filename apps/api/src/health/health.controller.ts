import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/decoradores/publico.decorator';
import { HealthService, ReporteSalud } from './health.service';

@Publico()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** GET /api/v1/health — siempre responde 200; el detalle indica qué dependencia falla. */
  @Get()
  obtener(): Promise<ReporteSalud> {
    return this.health.reporte();
  }
}
