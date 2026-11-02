import { Inject, Injectable } from '@nestjs/common';
import {
  NOMBRE_TIEMPO,
  ajustarPresupuesto,
  asignarMenu,
  fechaReferenciaMotor,
  platillosFaltantes,
  textoFaltantes,
  aCentavos,
  deCentavos,
  type CandidatoMotor,
  type FijadoMotor,
  type PesosMotor,
  type ResultadoAjuste,
  type TiempoComida,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import { PlatillosRepositorio } from '../catalogo/platillos.repositorio';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { DIAS_SEMANA, sumarDias } from '../configuracion/semanas';
import { PreferenciasRepositorio } from '../preferencias/preferencias.repositorio';
import type { GenerarMenuDto } from './dto/menus.dto';
import { RELOJ_MENUS } from './menus.constants';
import { construirCandidatos, costosPorPlatillo, ultimaFechaHistorial } from './menus.motor';
import {
  MenuDuplicadoError,
  MenusRepositorio,
  type DatosMenu,
  type DetalleConPlatillo,
  type FilaDetalleNueva,
  type FilaTiempoNueva,
} from './menus.repositorio';
import { vistaMenu, type VistaMenu } from './menus.vista';

export interface ResultadoGeneracion {
  /** true si se creó un menú nuevo (201); false si se regeneró un Borrador (200). */
  creado: boolean;
  menu: VistaMenu;
}

const COMIDAS_POR_SEMANA = 7;
const numero = (texto: string | null): number => (texto === null ? 0 : Number(texto));
const dec4 = (n: number) => n.toFixed(4);

/** Un espacio fijado conserva el puntaje y los factores con que se generó (CU-05.1 1a). */
function fijadoDeMotor(d: DetalleConPlatillo): FijadoMotor {
  return {
    fecha: d.fecha,
    tiempo: d.tiempo,
    candidato: {
      id: d.platilloId as string,
      nombre: d.platilloNombre as string,
      proteina: d.platilloProteina!,
      puntaje: numero(d.puntaje),
      factores: {
        preferencia: numero(d.factorPreferencia),
        novedad: numero(d.factorNovedad),
        ahorro: numero(d.factorAhorro),
        afinidad: numero(d.factorAfinidad),
      },
      costo: d.costoEstimado === null ? null : Number(d.costoEstimado),
    },
  };
}

/** "Q22.00 más barato": lo que bajó el espacio desde el platillo con que empezó (RN-05). */
function notaReemplazo(r: ResultadoAjuste, fecha: string): string | null {
  const cambios = r.reemplazos.filter((x) => x.fecha === fecha);
  if (cambios.length === 0) return null;
  const centavos = (costo: number | null) => Math.round((costo ?? 0) * 100);
  const ahorro = centavos(cambios[0]!.de.costo) - centavos(cambios[cambios.length - 1]!.a.costo);
  return `Q${deCentavos(ahorro)} más barato`;
}

function filaDetalle(
  fecha: string,
  tiempo: TiempoComida,
  c: CandidatoMotor | null,
  nota: string | null = null,
): FilaDetalleNueva {
  return {
    fecha,
    tiempo,
    platilloId: c?.id ?? null,
    ...(nota
      ? {
          origen: 'REEMPLAZO_PRESUPUESTO' as const,
          reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
          notas: nota,
        }
      : {}),
    puntaje: c ? dec4(c.puntaje) : null,
    factorPreferencia: c ? dec4(c.factores.preferencia) : null,
    factorNovedad: c ? dec4(c.factores.novedad) : null,
    factorAhorro: c ? dec4(c.factores.ahorro) : null,
    factorAfinidad: c ? dec4(c.factores.afinidad) : null,
    costoEstimado: c?.costo != null ? c.costo.toFixed(2) : null,
    // Sin precios (S5) el costo de un platillo siempre es incompleto (D-18).
    costoIncompleto: c !== null && c.costo === null,
  };
}

const COSTO_CERO = '0.00';

/** M05 · CU-05.1 — generar el Borrador del menú de una semana (HU-19). */
@Injectable()
export class MenusService {
  constructor(
    private readonly repo: MenusRepositorio,
    private readonly configuracion: ConfiguracionService,
    private readonly platillos: PlatillosRepositorio,
    private readonly preferencias: PreferenciasRepositorio,
    @Inject(RELOJ_MENUS) private readonly reloj: () => Date,
  ) {}

  async generar(hogarId: string, dto: GenerarMenuDto): Promise<ResultadoGeneracion> {
    const config = await this.configuracion.obtener(hogarId);
    this.validarSemana(dto.semana, config.diaInicioSemana);
    const activos = config.tiempos.filter((t) => t.activo);
    if (activos.length === 0 || Number(config.presupuestoSemanal) <= 0) {
      throw new Problema(
        422,
        'CONFIGURACION_INCOMPLETA',
        'Completa los tiempos de comida y el presupuesto antes de sugerir el menú.',
      );
    }

    const existente = await this.repo.menuDeSemana(hogarId, dto.semana);
    if (existente?.estado === 'APROBADO') {
      throw new Problema(409, 'MENU_APROBADO', 'Esta semana ya tiene un menú aprobado', {
        menuId: existente.id,
      });
    }
    if (existente?.estado === 'HISTORICO') {
      throw new Problema(
        409,
        'SEMANA_HISTORICA',
        'Esta semana ya está registrada en el historial',
        {
          menuId: existente.id,
        },
      );
    }
    if (existente && !dto.regenerar) {
      throw new Problema(
        409,
        'BORRADOR_EXISTENTE',
        'Esta semana ya tiene un borrador. Confirma si quieres regenerarlo.',
        { menuId: existente.id },
      );
    }

    const tiempos = activos.map((t) => t.tiempo);
    const [todos, excluidos, preparaciones, sumaFactores] = await Promise.all([
      this.repo.platillosActivos(hogarId),
      this.preferencias.platillosExcluidosParaMotor(hogarId),
      this.repo.preparaciones(hogarId, dto.semana),
      this.platillos.sumaFactores(hogarId),
    ]);
    const aplicables = todos.filter((p) => !excluidos.has(p.id));
    const faltantes = platillosFaltantes(
      tiempos,
      Object.fromEntries(tiempos.map((t) => [t, aplicables.filter((p) => p.tiempo === t).length])),
    );
    if (faltantes.length > 0) {
      throw new Problema(
        422,
        'FALTAN_PLATILLOS',
        textoFaltantes(faltantes, (t) => NOMBRE_TIEMPO[t]),
        { faltantes },
      );
    }

    const pesos: PesosMotor = {
      preferencia: Number(config.pesos.preferencia),
      novedad: Number(config.pesos.novedad),
      ahorro: Number(config.pesos.ahorro),
      afinidad: Number(config.pesos.afinidad),
    };
    const costos = costosPorPlatillo(
      [...new Set(aplicables.map((p) => p.id))],
      await this.repo.ingredientesParaCosto(hogarId, [...new Set(aplicables.map((p) => p.id))]),
      sumaFactores,
    );
    const referencia = fechaReferenciaMotor(dto.semana, ultimaFechaHistorial(preparaciones));
    const fechas = Array.from({ length: COMIDAS_POR_SEMANA }, (_, i) => sumarDias(dto.semana, i));
    const candidatos = Object.fromEntries(
      activos.map((t) => [
        t.tiempo,
        construirCandidatos({
          tiempo: t.tiempo,
          platillos: aplicables.filter((p) => p.tiempo === t.tiempo),
          preparaciones,
          referencia,
          presupuestoPorComida: Number(t.monto) / COMIDAS_POR_SEMANA,
          pesos,
          costos,
        }),
      ]),
    );

    const previos = existente ? await this.repo.fijados(existente.id) : [];
    const vigentes = previos.filter(
      (d) => tiempos.includes(d.tiempo) && fechas.includes(d.fecha) && d.platilloId !== null,
    );
    const { asignaciones } = asignarMenu({
      fechas,
      tiempos,
      candidatos,
      fijados: vigentes.map(fijadoDeMotor),
    });
    // CU-05.3: por tiempo, reemplaza los más caros no fijados hasta cumplir el presupuesto (RN-05).
    const ajustes = new Map<TiempoComida, ResultadoAjuste>(
      activos.map((t) => [
        t.tiempo,
        ajustarPresupuesto({
          presupuesto: Number(t.monto),
          espacios: asignaciones
            .filter((a) => a.tiempo === t.tiempo)
            .map((a) => ({ fecha: a.fecha, candidato: a.candidato, fijado: a.fijado })),
          candidatos: candidatos[t.tiempo] ?? [],
        }),
      ]),
    );
    const nuevos = activos.flatMap((t) => {
      const ajuste = ajustes.get(t.tiempo)!;
      return ajuste.espacios
        .filter((e) => !e.fijado)
        .map((e) => filaDetalle(e.fecha, t.tiempo, e.candidato, notaReemplazo(ajuste, e.fecha)));
    });
    const conCosto = [...ajustes.values()].filter((a) =>
      a.espacios.some((e) => e.candidato?.costo != null),
    );
    const costoMenu = conCosto.reduce((s, a) => s + (aCentavos(a.costo.toFixed(2)) ?? 0), 0);
    const datos: DatosMenu = {
      fechaFin: fechas[COMIDAS_POR_SEMANA - 1] as string,
      configuracionVersion: config.version,
      presupuestoSemanal: config.presupuestoSemanal,
      sumaFactoresPorcion: sumaFactores.toFixed(2),
      pesoPreferencia: config.pesos.preferencia,
      pesoNovedad: config.pesos.novedad,
      pesoAhorro: config.pesos.ahorro,
      pesoAfinidad: config.pesos.afinidad,
      costoEstimado: conCosto.length > 0 ? deCentavos(costoMenu) : null,
      costoIncompleto: [...ajustes.values()].some((a) => a.incompleto),
      generadoEn: this.reloj(),
    };
    const filasTiempo: FilaTiempoNueva[] = activos.map((t) => {
      const ajuste = ajustes.get(t.tiempo)!;
      const conocido = ajuste.espacios.some((e) => e.candidato?.costo != null);
      return {
        tiempo: t.tiempo,
        porcentaje: t.porcentaje,
        presupuesto: t.monto,
        costoEstimado: conocido ? ajuste.costo.toFixed(2) : null,
        exceso: conocido ? ajuste.exceso.toFixed(2) : COSTO_CERO,
        intentosAjuste: ajuste.intentos,
      };
    });

    let menuId: string;
    try {
      if (existente) {
        await this.repo.regenerar(
          existente.id,
          existente.version,
          datos,
          filasTiempo,
          vigentes.map((d) => d.id),
          nuevos,
        );
        menuId = existente.id;
      } else {
        menuId = await this.repo.crear(hogarId, dto.semana, datos, filasTiempo, nuevos);
      }
    } catch (error) {
      if (error instanceof MenuDuplicadoError) {
        throw new Problema(
          409,
          'BORRADOR_EXISTENTE',
          'Esta semana ya tiene un menú. Vuelve a intentarlo.',
        );
      }
      throw error;
    }
    const completo = await this.repo.cargar(hogarId, menuId);
    // CU-05.3 E1: las alternativas más baratas solo viajan en la respuesta de generar.
    const vista = vistaMenu(completo!);
    const menu: VistaMenu = {
      ...vista,
      tiempos: vista.tiempos.map((t) => {
        const alternativas = ajustes.get(t.tiempo)?.alternativas ?? [];
        return alternativas.length === 0
          ? t
          : {
              ...t,
              alternativas: alternativas.map((a) => ({
                fecha: a.fecha,
                platillos: a.platillos.map((p) => ({
                  id: p.id,
                  nombre: p.nombre,
                  costo: (p.costo as number).toFixed(2),
                })),
              })),
            };
      }),
    };
    return { creado: !existente, menu };
  }

  /** La semana debe ser una fecha real que caiga en el día de inicio configurado (RN-09). */
  private validarSemana(semana: string, diaInicio: string): void {
    const fecha = new Date(`${semana}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== semana) {
      throw new Problema(422, 'SEMANA_INVALIDA', 'La semana no es una fecha válida.');
    }
    const dia = DIAS_SEMANA[fecha.getUTCDay()];
    if (dia !== diaInicio) {
      throw new Problema(
        422,
        'SEMANA_INVALIDA',
        `La semana debe empezar el ${diaInicio.toLowerCase()}.`,
      );
    }
  }
}
