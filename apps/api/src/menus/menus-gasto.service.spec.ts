import type { MenuSemanal } from '@menu/db';
import { Problema } from '../comun/problema';
import { MenusGastoService } from './menus-gasto.service';
import type { MenuCompleto, MenusRepositorio } from './menus.repositorio';

const AHORA = new Date('2026-11-08T16:00:00.000Z');

const completo = (menu: Partial<MenuSemanal> = {}): MenuCompleto => ({
  menu: {
    id: 'm1',
    estado: 'APROBADO',
    presupuestoSemanal: '245.00',
    costoEstimado: '229.50',
    gastoReal: null,
    notaGasto: null,
    gastoRegistradoEn: null,
    ...menu,
  } as MenuSemanal,
  tiempos: [],
  detalles: [],
});

function preparar(inicial: MenuCompleto | undefined, guardado = true) {
  const registrada = completo({
    gastoReal: '238.75',
    notaGasto: 'Paiz',
    gastoRegistradoEn: AHORA,
  });
  const repo = {
    cargar: jest.fn().mockResolvedValueOnce(inicial).mockResolvedValue(registrada),
    registrarGasto: jest.fn().mockResolvedValue(guardado),
  };
  const servicio = new MenusGastoService(repo as unknown as MenusRepositorio, () => AHORA);
  return { repo, servicio };
}

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (e) {
    return e as Problema;
  }
  throw new Error('Se esperaba un Problema');
}

describe('MenusGastoService (CU-06.4, HU-27)', () => {
  it('CA-27.1 guarda el monto con el usuario y la hora, y devuelve las diferencias', async () => {
    const { repo, servicio } = preparar(completo());

    const r = await servicio.registrar('h1', 'u1', 'm1', { monto: '238.75', nota: '  Paiz  ' });

    expect(repo.registrarGasto).toHaveBeenCalledWith('h1', 'm1', {
      usuarioId: 'u1',
      monto: '238.75',
      nota: 'Paiz',
      registradoEn: AHORA,
    });
    expect(r).toMatchObject({
      gastoReal: '238.75',
      diferenciaVsEstimado: { texto: 'Q9.25 más que lo estimado' },
      diferenciaVsPresupuesto: { texto: 'Q6.25 por debajo del presupuesto' },
    });
  });

  it('un número sin nota se guarda con 2 decimales y nota nula', async () => {
    const { repo, servicio } = preparar(completo());
    await servicio.registrar('h1', 'u1', 'm1', { monto: 240, nota: '   ' });
    expect(repo.registrarGasto).toHaveBeenCalledWith(
      'h1',
      'm1',
      expect.objectContaining({ monto: '240.00', nota: null }),
    );
  });

  it('un menú de otro hogar o inexistente es 404', async () => {
    const { servicio } = preparar(undefined);
    const e = await problema(servicio.registrar('h1', 'u1', 'm1', { monto: '10' }));
    expect(e).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(e.getStatus()).toBe(404);
  });

  it('CA-27.4 un Borrador es 409 MENU_NO_APROBADO y no guarda', async () => {
    const { repo, servicio } = preparar(completo({ estado: 'BORRADOR' }));
    const e = await problema(servicio.registrar('h1', 'u1', 'm1', { monto: '10' }));
    expect(e).toMatchObject({ codigo: 'MENU_NO_APROBADO' });
    expect(e.getStatus()).toBe(409);
    expect(repo.registrarGasto).not.toHaveBeenCalled();
  });

  it('el histórico es 409 SEMANA_HISTORICA', async () => {
    const { servicio } = preparar(completo({ estado: 'HISTORICO' }));
    const e = await problema(servicio.registrar('h1', 'u1', 'm1', { monto: '10' }));
    expect(e).toMatchObject({ codigo: 'SEMANA_HISTORICA' });
  });

  it('CA-27.3 un monto inválido es 422 MONTO_INVALIDO con su mensaje y no guarda', async () => {
    const { repo, servicio } = preparar(completo());
    for (const [monto, mensaje] of [
      ['0', 'El monto debe ser mayor que Q0.00'],
      ['120.555', 'El monto admite como máximo 2 decimales'],
      [undefined, 'Escribe un monto válido'],
      [['5'], 'Escribe un monto válido'],
    ] as const) {
      repo.cargar.mockResolvedValueOnce(completo());
      const e = await problema(servicio.registrar('h1', 'u1', 'm1', { monto }));
      expect(e).toMatchObject({ codigo: 'MONTO_INVALIDO', detalle: mensaje });
      expect(e.getStatus()).toBe(422);
    }
    expect(repo.registrarGasto).not.toHaveBeenCalled();
  });

  it('si el menú dejó de estar aprobado al guardar es 409', async () => {
    const { servicio } = preparar(completo(), false);
    const e = await problema(servicio.registrar('h1', 'u1', 'm1', { monto: '10' }));
    expect(e).toMatchObject({ codigo: 'MENU_NO_APROBADO' });
  });
});
