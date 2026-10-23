import { Injectable } from '@nestjs/common';
import type { Platillo } from '@menu/db';
import {
  LARGO_MAXIMO_ETIQUETA,
  LARGO_MAXIMO_NOMBRE_PLATILLO,
  MAXIMO_ETIQUETAS,
  MENSAJES_CATALOGO,
  ORDEN_TIEMPOS,
  PORCIONES_BASE_MAXIMAS,
  PORCIONES_BASE_MINIMAS,
  ProteinaPrincipal,
  escalarCantidad,
  limpiarTexto,
  normalizarNombreCatalogo,
  separarEtiquetas,
  unidadCompatible,
  type TiempoComida,
} from '@menu/shared';
import { Problema, type ErrorCampo } from '../comun/problema';
import type {
  DetallePlatillo,
  IngredienteDePlatillo,
  OrigenSumaFactores,
  Pagina,
  PlatilloConVistaPrevia,
  ResumenPlatillo,
  VistaPrevia,
  VistaUnidad,
} from './catalogo.tipos';
import type { ConsultaPlatillosDto, DatosPlatilloDto, IngredientesDto } from './dto/catalogo.dto';
import { paginar } from './paginacion';
import {
  PlatilloDuplicadoError,
  PlatillosRepositorio,
  type DatosPlatillo,
  type EtiquetaNueva,
  type FilaIngrediente,
  type ItemIngrediente,
} from './platillos.repositorio';
import { ProductosRepositorio } from './productos.repositorio';
import { cantidadValida, problemaCampo, vistaProducto } from './productos.service';

const noEncontrado = () => new Problema(404, 'NO_ENCONTRADO', 'El platillo no existe.');

function unidadDe(f: {
  unidadId: string;
  unidadCodigo: string;
  unidadNombre: string;
  unidadMagnitud: VistaUnidad['magnitud'];
  unidadFactorBase: string | null;
}): VistaUnidad {
  return {
    id: f.unidadId,
    codigo: f.unidadCodigo,
    nombre: f.unidadNombre,
    magnitud: f.unidadMagnitud,
    factorBase: f.unidadFactorBase,
  };
}

/** Ingrediente guardado → vista con producto, etiqueta y unidades. */
export function vistaIngrediente(f: FilaIngrediente): IngredienteDePlatillo {
  const producto = vistaProducto(f.producto);
  return {
    id: f.id,
    producto: {
      id: producto.id,
      nombre: producto.nombre,
      etiqueta: producto.etiqueta,
      activo: producto.activo,
      presentacionUnidad: producto.presentacion.unidad,
    },
    cantidad: f.cantidad,
    unidad: unidadDe(f),
  };
}

/** RN-07: vista previa de cada ingrediente escalado a `sumaFactores`. */
export function calcularVistaPrevia(
  porcionesBase: number,
  sumaFactores: number,
  origen: OrigenSumaFactores,
  ingredientes: IngredienteDePlatillo[],
): VistaPrevia {
  return {
    porcionesBase,
    sumaFactores: sumaFactores.toFixed(2),
    origen,
    ingredientes: ingredientes.map((i) => ({
      productoId: i.producto.id,
      nombre: i.producto.nombre,
      cantidadBase: i.cantidad,
      cantidadEscalada: escalarCantidad(i.cantidad, porcionesBase, sumaFactores).toFixed(3),
      unidad: i.unidad.codigo,
    })),
  };
}

interface DatosValidados {
  datos: Partial<DatosPlatillo>;
  tiempos?: TiempoComida[];
  etiquetas?: EtiquetaNueva[];
}

/** Casos de uso de platillos (CU-03.1 · RF-11) e ingredientes (CU-03.2 · RF-12) del hogar. */
@Injectable()
export class PlatillosService {
  constructor(
    private readonly platillos: PlatillosRepositorio,
    private readonly productos: ProductosRepositorio,
  ) {}

  /** CU-03.1 pasos 1–2: activos por nombre; búsqueda por texto sin tildes y filtros. */
  async listar(hogarId: string, consulta: ConsultaPlatillosDto): Promise<Pagina<ResumenPlatillo>> {
    const q = consulta.q ? normalizarNombreCatalogo(consulta.q) : '';
    const etiqueta = consulta.etiqueta ? normalizarNombreCatalogo(consulta.etiqueta) : '';
    const { filas, total } = await this.platillos.listar(
      hogarId,
      {
        q: q || undefined,
        tiempo: consulta.tiempo,
        proteina: consulta.proteina,
        etiqueta: etiqueta || undefined,
        ingrediente: consulta.ingrediente,
        estado: consulta.estado,
      },
      consulta.pagina,
      consulta.tamano,
    );
    return paginar(await this.resumenes(filas), consulta.pagina, consulta.tamano, total);
  }

  async obtener(hogarId: string, id: string): Promise<DetallePlatillo> {
    const fila = await this.platillos.buscar(hogarId, id);
    if (!fila) throw noEncontrado();
    const [resumen] = await this.resumenes([fila]);
    const ingredientes = (await this.platillos.ingredientes(id)).map(vistaIngrediente);
    return {
      ...(resumen as ResumenPlatillo),
      ingredientes,
      advertencias: ingredientes
        .filter((i) => !i.producto.activo)
        .map((i) => ({
          codigo: 'INGREDIENTE_INACTIVO' as const,
          mensaje: MENSAJES_CATALOGO.ingredienteInactivo(i.producto.nombre),
          productoId: i.producto.id,
        })),
    };
  }

  /** CU-03.1 pasos 3–6 con E1 (nombre), E2 (tiempos) y E3 (duplicado). */
  async crear(hogarId: string, dto: DatosPlatilloDto): Promise<DetallePlatillo> {
    const { datos, tiempos, etiquetas } = this.validar(
      { proteinaPrincipal: ProteinaPrincipal.OTRA, etiquetas: [], ...dto },
      true,
    );
    const completos = datos as DatosPlatillo;
    await this.rechazarDuplicado(hogarId, completos.nombreNormalizado);
    let id: string;
    try {
      id = await this.platillos.crear(hogarId, completos, tiempos ?? [], etiquetas ?? []);
    } catch (error) {
      if (error instanceof PlatilloDuplicadoError) {
        await this.rechazarDuplicado(hogarId, completos.nombreNormalizado);
      }
      throw error;
    }
    return this.obtener(hogarId, id);
  }

  async actualizar(hogarId: string, id: string, dto: DatosPlatilloDto): Promise<DetallePlatillo> {
    if (!(await this.platillos.buscar(hogarId, id))) throw noEncontrado();
    const { datos, tiempos, etiquetas } = this.validar(dto, false);
    if (datos.nombreNormalizado) await this.rechazarDuplicado(hogarId, datos.nombreNormalizado, id);
    try {
      await this.platillos.actualizar(hogarId, id, datos, tiempos, etiquetas);
    } catch (error) {
      if (error instanceof PlatilloDuplicadoError && datos.nombreNormalizado) {
        await this.rechazarDuplicado(hogarId, datos.nombreNormalizado, id);
      }
      throw error;
    }
    return this.obtener(hogarId, id);
  }

  /** CU-03.1 3a: deja de listarse entre los activos y de proponerse en el motor (CA-11.2). */
  async inactivar(hogarId: string, id: string): Promise<DetallePlatillo> {
    if (!(await this.platillos.cambiarActivo(hogarId, id, false))) throw noEncontrado();
    return this.obtener(hogarId, id);
  }

  /** CU-03.1 3b. */
  async reactivar(hogarId: string, id: string): Promise<DetallePlatillo> {
    if (!(await this.platillos.cambiarActivo(hogarId, id, true))) throw noEncontrado();
    return this.obtener(hogarId, id);
  }

  /**
   * CU-03.2 pasos 2–7: valida cantidad (E1), magnitud de la unidad (E2) y producto repetido (E3)
   * de cada ítem; guarda en una transacción y devuelve la vista previa escalada (RN-07).
   */
  async guardarIngredientes(
    hogarId: string,
    id: string,
    dto: IngredientesDto,
  ): Promise<PlatilloConVistaPrevia> {
    const actual = await this.platillos.buscar(hogarId, id);
    if (!actual) throw noEncontrado();
    const porciones = dto.porcionesBase;
    if (
      !Number.isInteger(porciones) ||
      porciones < PORCIONES_BASE_MINIMAS ||
      porciones > PORCIONES_BASE_MAXIMAS
    ) {
      throw problemaCampo(
        'PORCIONES_INVALIDAS',
        'porcionesBase',
        MENSAJES_CATALOGO.porcionesInvalidas,
      );
    }
    const items = await this.validarIngredientes(id, dto);
    await this.platillos.reemplazarIngredientes(hogarId, id, porciones, items);
    const detalle = await this.obtener(hogarId, id);
    return { ...detalle, vistaPrevia: await this.vistaPreviaDe(hogarId, detalle) };
  }

  /** CU-03.2 paso 7 · CA-12.5: con `sumaFactores` dada o la de los comensales activos. */
  async vistaPrevia(hogarId: string, id: string, sumaFactores?: number): Promise<VistaPrevia> {
    return this.vistaPreviaDe(hogarId, await this.obtener(hogarId, id), sumaFactores);
  }

  private async vistaPreviaDe(
    hogarId: string,
    detalle: DetallePlatillo,
    sumaFactores?: number,
  ): Promise<VistaPrevia> {
    let suma = sumaFactores ?? 0;
    let origen: OrigenSumaFactores = 'PARAMETRO';
    if (sumaFactores === undefined) {
      suma = await this.platillos.sumaFactores(hogarId);
      origen = 'COMENSALES';
      if (suma <= 0) {
        suma = detalle.porcionesBase;
        origen = 'PORCIONES_BASE';
      }
    }
    return calcularVistaPrevia(detalle.porcionesBase, suma, origen, detalle.ingredientes);
  }

  private async validarIngredientes(
    platilloId: string,
    dto: IngredientesDto,
  ): Promise<ItemIngrediente[]> {
    const ids = [...new Set(dto.ingredientes.map((i) => i.productoId))];
    const productos = await this.platillos.productosParaIngredientes(ids);
    const unidades = new Map((await this.productos.unidades()).map((u) => [u.id, u]));
    const yaUsados = new Set(
      (await this.platillos.ingredientes(platilloId)).map((i) => i.producto.id),
    );
    const errores: (ErrorCampo & { codigo: string })[] = [];
    const vistos = new Set<string>();
    const items: ItemIngrediente[] = [];

    dto.ingredientes.forEach((item, i) => {
      const campo = `ingredientes.${i}`;
      const falla = (codigo: string, sufijo: string, mensaje: string) =>
        errores.push({ codigo, campo: `${campo}.${sufijo}`, mensaje });
      const producto = productos.get(item.productoId);
      if (!producto)
        return falla('PRODUCTO_NO_EXISTE', 'productoId', MENSAJES_CATALOGO.productoNoExiste);
      if (vistos.has(item.productoId)) {
        return falla(
          'PRODUCTO_REPETIDO',
          'productoId',
          MENSAJES_CATALOGO.productoRepetido(producto.nombre),
        );
      }
      vistos.add(item.productoId);
      if (!producto.activo && !yaUsados.has(producto.id)) {
        return falla(
          'PRODUCTO_INACTIVO',
          'productoId',
          MENSAJES_CATALOGO.productoInactivo(producto.nombre),
        );
      }
      const cantidad = cantidadValida(item.cantidad);
      if (!cantidad)
        return falla('CANTIDAD_INVALIDA', 'cantidad', MENSAJES_CATALOGO.cantidadInvalida);
      const unidad = unidades.get(item.unidadId);
      if (!unidad) return falla('UNIDAD_NO_EXISTE', 'unidadId', 'Elige una unidad de la lista');
      if (!unidadCompatible(unidad, producto, producto.equivalencias)) {
        return falla(
          'UNIDAD_INCOMPATIBLE',
          'unidadId',
          MENSAJES_CATALOGO.unidadIncompatible(unidad.codigo, producto.unidadCodigo),
        );
      }
      items.push({ productoId: item.productoId, cantidad, unidadId: item.unidadId });
    });

    const primera = errores[0];
    if (primera) {
      throw new Problema(422, primera.codigo, primera.mensaje, {
        errores: errores.map(({ campo, mensaje }) => ({ campo, mensaje })),
      });
    }
    return items;
  }

  private validar(dto: DatosPlatilloDto, nuevo: boolean): DatosValidados {
    const resultado: DatosValidados = { datos: {} };
    if (nuevo || dto.nombre !== undefined) {
      const nombre = limpiarTexto(dto.nombre ?? '');
      if (!nombre) {
        throw problemaCampo(
          'NOMBRE_OBLIGATORIO',
          'nombre',
          MENSAJES_CATALOGO.nombrePlatilloObligatorio,
        );
      }
      if (nombre.length > LARGO_MAXIMO_NOMBRE_PLATILLO) {
        throw problemaCampo('NOMBRE_LARGO', 'nombre', MENSAJES_CATALOGO.nombrePlatilloLargo);
      }
      resultado.datos.nombre = nombre;
      resultado.datos.nombreNormalizado = normalizarNombreCatalogo(nombre);
    }
    if (nuevo || dto.tiempos !== undefined) {
      const tiempos = ORDEN_TIEMPOS.filter((t) => dto.tiempos?.includes(t));
      if (tiempos.length === 0) {
        throw problemaCampo('SIN_TIEMPO', 'tiempos', MENSAJES_CATALOGO.sinTiempo);
      }
      resultado.tiempos = tiempos;
    }
    if (dto.proteinaPrincipal !== undefined)
      resultado.datos.proteinaPrincipal = dto.proteinaPrincipal;
    if (dto.favorito !== undefined) resultado.datos.favorito = dto.favorito;
    if (dto.etiquetas !== undefined) {
      const etiquetas = separarEtiquetas(dto.etiquetas);
      if (etiquetas.length > MAXIMO_ETIQUETAS) {
        throw problemaCampo('MAX_ETIQUETAS', 'etiquetas', MENSAJES_CATALOGO.maximoEtiquetas);
      }
      if (etiquetas.some((e) => e.length > LARGO_MAXIMO_ETIQUETA)) {
        throw problemaCampo('ETIQUETA_LARGA', 'etiquetas', MENSAJES_CATALOGO.etiquetaLarga);
      }
      resultado.etiquetas = etiquetas.map((nombre) => ({
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
      }));
    }
    return resultado;
  }

  /** CU-03.1 E3 · CA-11.3: 409 con el existente para ofrecer abrirlo. */
  private async rechazarDuplicado(
    hogarId: string,
    nombreNormalizado: string,
    excluirId?: string,
  ): Promise<void> {
    const existente = await this.platillos.buscarPorNombre(hogarId, nombreNormalizado, excluirId);
    if (!existente) return;
    throw new Problema(
      409,
      'PLATILLO_DUPLICADO',
      MENSAJES_CATALOGO.platilloDuplicado(existente.nombre),
      { existenteId: existente.id, existenteNombre: existente.nombre },
    );
  }

  private async resumenes(filas: Platillo[]): Promise<ResumenPlatillo[]> {
    const ids = filas.map((f) => f.id);
    const [tiempos, etiquetas, inactivos] = await Promise.all([
      this.platillos.tiempos(ids),
      this.platillos.etiquetas(ids),
      this.platillos.ingredientesInactivos(ids),
    ]);
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      tiempos: tiempos.get(f.id) ?? [],
      proteinaPrincipal: f.proteinaPrincipal as ProteinaPrincipal,
      etiquetas: etiquetas.get(f.id) ?? [],
      porcionesBase: f.porcionesBase,
      favorito: f.favorito,
      incompleto: f.incompleto,
      activo: f.activo,
      calificacionPromedio: f.calificacionPromedio,
      ingredientesInactivos: inactivos.get(f.id) ?? 0,
    }));
  }
}
