import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService, ReporteSalud } from './health.service';

describe('HealthController', () => {
  it('delega en HealthService', async () => {
    const reporte = { status: 'ok' } as ReporteSalud;
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: { reporte: () => Promise.resolve(reporte) } },
      ],
    }).compile();
    await expect(moduleRef.get(HealthController).obtener()).resolves.toBe(reporte);
  });
});
