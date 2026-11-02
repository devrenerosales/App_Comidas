import { Inject, Injectable } from '@nestjs/common';
import {
  PESOS_MOTOR_POR_DEFECTO,
  fechaReferenciaMotor,
  siguienteAlternativa,
  type PesosMotor,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import { PreferenciasRepositorio } from '../preferencias/preferencias.repositorio';
import { RELOJ_MENUS } from './menus.constants';
import { exigirBorrador } from './menus.guardas';
import { construirCandidatos, ultimaFechaHistorial } from './menus.motor';
import { MenusRepositorio } from './menus.repositorio';
import { vistaMenu, type VistaMenu } from './menus.vista';

const COMIDAS_POR_SEMANA = 7;

/** M05 · CU-05.5 — pedir otra opción para un día y tiempo sin regenerar la semana (HU-23). */
@Injectable()
export class MenusAlternativaService {
  constructor(
    private readonly repo: MenusRepositorio,
    private readonly preferencias: PreferenciasRepositorio,
    @Inject(RELOJ_MENUS) private readonly reloj: () => Date,
  ) {}

  async alternativa(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    detalleId: string,
  ): Promise<VistaMenu> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw new Problema(404, 'NO_ENCONTRADO', 'El menú no existe.');
    exigirBorrador(completo.menu);
    const espacio = completo.detalles.find((d) => d.id === detalleId);
    if (!espacio) throw new Problema(404, 'NO_ENCONTRADO', 'La comida no existe.');
    if (espacio.fijado) {
      throw new Problema(
        409,
        'ESPACIO_FIJADO',
        'Este platillo está fijado. Quita el fijado antes de pedir otra opción.',
      );
    }

    const { menu } = completo;
    const tiempo = completo.tiempos.find((t) => t.tiempo === espacio.tiempo);
    const [todos, excluidos, preparaciones, mostradas] = await Promise.all([
      this.repo.platillosActivos(hogarId),
      this.preferencias.platillosExcluidosParaMotor(hogarId),
      this.repo.preparaciones(hogarId, menu.fechaInicio),
      this.repo.alternativasMostradas(espacio.id),
    ]);
    // Se puntúa con la copia de pesos y presupuesto con que se generó el menú (D-04).
    const pesos: PesosMotor = menu.pesoPreferencia
      ? {
          preferencia: Number(menu.pesoPreferencia),
          novedad: Number(menu.pesoNovedad),
          ahorro: Number(menu.pesoAhorro),
          afinidad: Number(menu.pesoAfinidad),
        }
      : PESOS_MOTOR_POR_DEFECTO;
    const candidatos = construirCandidatos({
      tiempo: espacio.tiempo,
      platillos: todos.filter((p) => p.tiempo === espacio.tiempo && !excluidos.has(p.id)),
      preparaciones,
      referencia: fechaReferenciaMotor(menu.fechaInicio, ultimaFechaHistorial(preparaciones)),
      presupuestoPorComida: Number(tiempo?.presupuesto ?? 0) / COMIDAS_POR_SEMANA,
      pesos,
    });
    const elegido = siguienteAlternativa({
      fecha: espacio.fecha,
      candidatos,
      excluidos: [...mostradas, ...(espacio.platilloId ? [espacio.platilloId] : [])],
      otros: completo.detalles
        .filter((d) => d.tiempo === espacio.tiempo && d.id !== espacio.id)
        .map((d) => ({ fecha: d.fecha, platilloId: d.platilloId, proteina: d.platilloProteina })),
    });
    if (!elegido) {
      throw new Problema(422, 'SIN_ALTERNATIVAS', 'No hay más alternativas para este día');
    }

    await this.repo.aplicarCambios(
      menuId,
      [
        {
          id: espacio.id,
          cambio: {
            platilloId: elegido.id,
            fijado: false,
            origen: 'ALTERNATIVA',
            puntaje: elegido.puntaje.toFixed(4),
            factorPreferencia: elegido.factores.preferencia.toFixed(4),
            factorNovedad: elegido.factores.novedad.toFixed(4),
            factorAhorro: elegido.factores.ahorro.toFixed(4),
            factorAfinidad: elegido.factores.afinidad.toFixed(4),
            costoEstimado: elegido.costo === null ? null : elegido.costo.toFixed(2),
            // Sin precios (S5) el costo de un platillo es siempre incompleto (D-18).
            costoIncompleto: elegido.costo === null,
            reglasAplicadas: [],
            modificadoPorId: usuarioId,
            modificadoEn: this.reloj(),
          },
        },
      ],
      // El reemplazado también cuenta como ya mostrado: no se vuelve a ofrecer (sin vaivén A↔B).
      [elegido.id, ...(espacio.platilloId ? [espacio.platilloId] : [])].map((platilloId) => ({
        detalleId: espacio.id,
        platilloId,
      })),
    );
    return vistaMenu((await this.repo.cargar(hogarId, menuId))!);
  }
}
