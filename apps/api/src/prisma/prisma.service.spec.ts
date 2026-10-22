import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Evita instanciar PrismaClient real: se prueba el comportamiento sobre el prototipo. */
function servicioSimulado(connect: () => Promise<void>) {
  const servicio = Object.create(PrismaService.prototype) as PrismaService;
  Object.assign(servicio, {
    $connect: jest.fn(connect),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    logger: new Logger('PrismaServiceTest'),
  });
  return servicio;
}

describe('PrismaService', () => {
  it('conecta al iniciar el módulo', async () => {
    const s = servicioSimulado(() => Promise.resolve());
    await s.onModuleInit();
    expect(s.$connect).toHaveBeenCalled();
  });

  it('no lanza si la BD no está disponible y deja un aviso', async () => {
    const s = servicioSimulado(() => Promise.reject(new Error('ECONNREFUSED')));
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(s.onModuleInit()).resolves.toBeUndefined();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    aviso.mockRestore();
  });

  it('desconecta al destruir el módulo', async () => {
    const s = servicioSimulado(() => Promise.resolve());
    await s.onModuleDestroy();
    expect(s.$disconnect).toHaveBeenCalled();
  });
});
