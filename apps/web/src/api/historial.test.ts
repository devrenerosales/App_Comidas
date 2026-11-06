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
  it('califica una comida con PUT /menus/{menuId}/detalles/{detalleId}/calificacion (HU-14)', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue({}) };
    await crearApiHistorial(cliente).calificar('m 1', 'd/1', 4);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/m%201/detalles/d%2F1/calificacion', {
      metodo: 'PUT',
      cuerpo: { valor: 4 },
    });
  });
});
