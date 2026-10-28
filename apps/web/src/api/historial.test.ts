import { describe, expect, it, vi } from 'vitest';
import { crearApiHistorial } from './historial';
describe('API de historial HU-15', () => {
  it('consulta con filtros y envía captura sin identificadores de hogar', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue({}) };
    const api = crearApiHistorial(cliente);
    await api.listar();
    expect(cliente.peticion).toHaveBeenLastCalledWith('/historial/semanas');
    await api.listar({ desde: '2025-04-01', pagina: 2 });
    expect(cliente.peticion).toHaveBeenLastCalledWith(
      '/historial/semanas?desde=2025-04-01&pagina=2',
    );
    const datos = { fechaInicio: '2025-04-06', detalles: [], reemplazar: true, version: 1 };
    await api.capturar(datos);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/historial/semanas', {
      metodo: 'POST',
      cuerpo: datos,
    });
  });
});
