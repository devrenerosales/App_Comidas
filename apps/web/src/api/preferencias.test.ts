import { describe, expect, it, vi } from 'vitest';
import { crearApiPreferencias } from './preferencias';

describe('API de restricciones y gustos (api-contrato §2.2)', () => {
  it('usa /hogar/preferencias/gustos con el método y el cuerpo del contrato', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue('ok') };
    const api = crearApiPreferencias(cliente);
    await api.obtener();
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/preferencias/gustos');
    const datos = { ingredientesExcluidos: ['p1'], favoritos: ['d1'] };
    await api.vistaPrevia(datos);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/preferencias/gustos/vista-previa', {
      metodo: 'POST',
      cuerpo: datos,
    });
    await api.guardar(datos);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/preferencias/gustos', {
      metodo: 'PUT',
      cuerpo: datos,
    });
  });
});
