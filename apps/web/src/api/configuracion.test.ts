import { describe, expect, it, vi } from 'vitest';
import { crearApiConfiguracion } from './configuracion';

describe('API de configuración (api-contrato §2.2)', () => {
  it('usa las rutas /hogar/configuracion con el método y el cuerpo del contrato', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue('ok') };
    const api = crearApiConfiguracion(cliente);
    await api.obtener();
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion');
    const previa = { tiempos: ['ALMUERZO' as const, 'CENA' as const] };
    await api.vistaPrevia(previa);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion/vista-previa', {
      metodo: 'POST',
      cuerpo: previa,
    });
    const tiempos = { version: 1, tiempos: [{ tiempo: 'ALMUERZO' as const, porcentaje: '100' }] };
    await api.guardarTiempos(tiempos);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion/tiempos', {
      metodo: 'PUT',
      cuerpo: tiempos,
    });
    const presupuesto = { version: 1, presupuestoSemanal: '500' };
    await api.guardarPresupuesto(presupuesto);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion/presupuesto', {
      metodo: 'PUT',
      cuerpo: presupuesto,
    });
    await api.obtenerSemana();
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion');
    const semana = {
      version: 1,
      diaInicioSemana: 'LUNES' as const,
      diaPlanificacion: 'SABADO' as const,
    };
    await api.vistaPreviaSemana(semana);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion/semana/vista-previa', {
      metodo: 'POST',
      cuerpo: semana,
    });
    await api.guardarSemana(semana);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/configuracion/semana', {
      metodo: 'PUT',
      cuerpo: semana,
    });
  });
});
