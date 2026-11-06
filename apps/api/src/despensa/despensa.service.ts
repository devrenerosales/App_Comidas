import { Injectable } from '@nestjs/common';
import { MENSAJES_DESPENSA, cantidadValida } from '@menu/shared';
import { Problema } from '../comun/problema';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import type { ActualizarDespensaDto, CrearDespensaDto } from './dto/despensa.dto';
import { DespensaRepositorio, type DatosDespensa } from './despensa.repositorio';
import { vistaDespensa, type VistaDespensa } from './despensa.vista';

const noEncontrado = () =>
  new Problema(404, 'NO_ENCONTRADO', 'El producto no está en la despensa.');

/** Cantidad en presentaciones de compra con 3 decimales, o 422 con el mensaje de CA-29.4 (E1). */
function cantidadDe(valor: unknown): string {
  const n = cantidadValida(typeof valor === 'string' || typeof valor === 'number' ? valor : null);
  if (n === null) throw new Problema(422, 'CANTIDAD_INVALIDA', MENSAJES_DESPENSA.cantidad);
  return n.toFixed(3);
}

const notaDe = (notas: string | undefined): string | null => notas?.trim() || null;

/** M07 · CU-07.2 — productos recurrentes del hogar y la frecuencia con que entran a la lista (HU-29). */
@Injectable()
export class DespensaService {
  constructor(
    private readonly repo: DespensaRepositorio,
    private readonly configuracion: ConfiguracionService,
  ) {}

  /** La semana de la próxima lista: la que el hogar planificará a continuación. */
  private async semana(hogarId: string): Promise<string> {
    return (await this.configuracion.obtener(hogarId)).proximaSemana.desde;
  }

  async listar(hogarId: string): Promise<VistaDespensa[]> {
    const semana = await this.semana(hogarId);
    return (await this.repo.listar(hogarId)).map((f) => vistaDespensa(f, semana));
  }

  /**
   * CU-07.2 paso 1: registra producto, cantidad y frecuencia. Un producto dado de baja se vuelve a
   * dar de alta con los valores nuevos; uno que ya está activo es 409 `YA_EN_DESPENSA`.
   */
  async crear(hogarId: string, dto: CrearDespensaDto): Promise<VistaDespensa> {
    const cantidad = cantidadDe(dto.cantidad);
    if (!(await this.repo.productoActivo(dto.productoId))) {
      throw new Problema(422, 'PRODUCTO_INVALIDO', 'Elige un producto del catálogo');
    }
    const datos: DatosDespensa = { cantidad, frecuencia: dto.frecuencia, notas: notaDe(dto.notas) };
    const existente = await this.repo.buscarPorProducto(hogarId, dto.productoId);
    let id: string;
    if (existente?.activo) {
      throw new Problema(409, 'YA_EN_DESPENSA', 'Este producto ya está en la despensa');
    }
    if (existente) {
      id = existente.id;
      await this.repo.reactivar(id, datos);
    } else {
      id = await this.repo.crear(hogarId, dto.productoId, datos);
    }
    return this.vista(hogarId, id);
  }

  /** Cambia cantidad, frecuencia o nota; la última inclusión no se toca. */
  async actualizar(
    hogarId: string,
    id: string,
    dto: ActualizarDespensaDto,
  ): Promise<VistaDespensa> {
    const parche: Partial<DatosDespensa> = {};
    if (dto.cantidad !== undefined) parche.cantidad = cantidadDe(dto.cantidad);
    if (dto.frecuencia !== undefined) parche.frecuencia = dto.frecuencia;
    if (dto.notas !== undefined) parche.notas = notaDe(dto.notas);
    if (Object.keys(parche).length === 0) return this.vista(hogarId, id);
    if (!(await this.repo.actualizar(hogarId, id, parche))) throw noEncontrado();
    return this.vista(hogarId, id);
  }

  /** Baja lógica: el producto deja de entrar a las listas. */
  async quitar(hogarId: string, id: string): Promise<void> {
    if (!(await this.repo.inactivar(hogarId, id))) throw noEncontrado();
  }

  private async vista(hogarId: string, id: string): Promise<VistaDespensa> {
    const fila = await this.repo.buscar(hogarId, id);
    if (!fila) throw noEncontrado();
    return vistaDespensa(fila, await this.semana(hogarId));
  }
}
