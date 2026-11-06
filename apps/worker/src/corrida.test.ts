import { describe, expect, it, vi } from 'vitest';
import {
  ErrorExtraccion,
  precioLeido,
  type AdaptadorSitio,
  type VinculoConsulta,
} from './adaptador.js';
import {
  ejecutarCorrida,
  INTENTOS_POR_PRODUCTO,
  type AvisoBloqueo,
  type DependenciasCorrida,
  type EstadoSitio,
  type RepositorioCorridas,
  type SitioConfigurado,
  type TotalesSitio,
} from './corrida.js';
import { LimitadorPorSitio, type Reloj } from './limitador.js';
import type { RespuestaRobots } from './robots.js';

/** Sábado 24/10/2026, 21:00 en Guatemala (UTC−6). */
const SABADO = new Date('2026-10-25T03:00:00Z');

/** Repositorio en memoria que registra lo que la corrida va guardando. */
class RepoMemoria implements RepositorioCorridas {
  enCurso = false;
  corridas: { id: string; estado: string; totales?: unknown }[] = [];
  sitiosAbiertos: { id: string; codigo: string; estado: EstadoSitio; totalVinculos: number }[] = [];
  cierres: { id: string; totales: TotalesSitio }[] = [];
  precios: { vinculoId: string; precio: string; fecha: string }[] = [];
  errores: { vinculoId: string | null; tipo: string; mensaje: string; intentos: number }[] = [];
  avisos: AvisoBloqueo[] = [];
  falla = false;

  constructor(
    readonly config: SitioConfigurado[],
    readonly vinculos: Record<string, VinculoConsulta[]>,
  ) {}

  async iniciarCorrida() {
    if (this.falla) throw new Error('sin conexión a la base de datos');
    const omitida = this.enCurso;
    const id = `c${this.corridas.length + 1}`;
    this.corridas.push({ id, estado: omitida ? 'OMITIDA' : 'EN_CURSO' });
    if (!omitida) this.enCurso = true;
    return { id, omitida };
  }
  async sitios() {
    if (this.falla) throw new Error('sin conexión a la base de datos');
    return this.config;
  }
  async vinculosActivos(supermercadoId: string) {
    return this.vinculos[supermercadoId] ?? [];
  }
  async abrirSitio(_c: string, supermercadoId: string, estado: EstadoSitio, total: number) {
    const codigo = this.config.find((s) => s.id === supermercadoId)!.codigo;
    const id = `s${this.sitiosAbiertos.length + 1}`;
    this.sitiosAbiertos.push({ id, codigo, estado, totalVinculos: total });
    return id;
  }
  async guardarPrecio(_c: string, v: VinculoConsulta, precio: string, fecha: string) {
    this.precios.push({ vinculoId: v.id, precio, fecha });
  }
  async registrarError(
    _s: string,
    vinculoId: string | null,
    tipo: string,
    mensaje: string,
    intentos: number,
  ) {
    this.errores.push({ vinculoId, tipo, mensaje, intentos });
  }
  async cerrarSitio(id: string, totales: TotalesSitio) {
    this.cierres.push({ id, totales });
  }
  async cerrarCorrida(id: string, estado: string, totales: unknown) {
    const c = this.corridas.find((x) => x.id === id)!;
    c.estado = estado;
    c.totales = totales;
    this.enCurso = false;
  }
  async avisarBloqueo(_c: string, aviso: AvisoBloqueo) {
    this.avisos.push(aviso);
  }
  cierreDe(codigo: string) {
    const s = this.sitiosAbiertos.find((x) => x.codigo === codigo)!;
    return this.cierres.find((c) => c.id === s.id)!.totales;
  }
}

const sitio = (codigo: string, extra: Partial<SitioConfigurado> = {}): SitioConfigurado => ({
  id: `id-${codigo}`,
  codigo,
  nombre: codigo === 'LA_TORRE' ? 'La Torre' : codigo[0] + codigo.slice(1).toLowerCase(),
  habilitado: true,
  extraccionPermitida: true,
  ...extra,
});

const vinculos = (codigo: string, n: number): VinculoConsulta[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${codigo}-${i}`,
    productoId: `p-${codigo}-${i}`,
    supermercadoId: `id-${codigo}`,
    nombreTienda: `Producto ${i}`,
    url: `https://${codigo.toLowerCase()}.test/producto/${i}`,
    sku: null,
    factor: '1',
  }));

/** Sitio simulado: lee el precio de un mapa y anota cuándo se le pidió cada cosa. */
function adaptadorSimulado(
  codigo: string,
  comportamiento: (v: VinculoConsulta, intento: number) => string | Error = () => '10.00',
  ruta = (v: VinculoConsulta) => `/producto/${v.id}`,
): AdaptadorSitio & { llamadas: string[] } {
  const intentos = new Map<string, number>();
  const llamadas: string[] = [];
  return {
    codigo,
    agente: 'MenuFamiliarBot/1.0',
    origen: `https://${codigo.toLowerCase()}.test`,
    llamadas,
    rutaProducto: ruta,
    async consultar(v) {
      llamadas.push(v.id);
      const n = (intentos.get(v.id) ?? 0) + 1;
      intentos.set(v.id, n);
      const r = comportamiento(v, n);
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

const robotsLibre = async (): Promise<RespuestaRobots> => ({
  estado: 'OK',
  texto: 'User-agent: *\nDisallow: /carrito\n',
});

function dependencias(
  repo: RepoMemoria,
  adaptadores: AdaptadorSitio[],
  extra: Partial<DependenciasCorrida> = {},
) {
  const encolarRecalculo = vi.fn().mockResolvedValue(undefined);
  const deps: DependenciasCorrida = {
    repo,
    adaptadores: new Map(adaptadores.map((a) => [a.codigo, a])),
    sitioEncendido: () => true,
    obtenerRobots: robotsLibre,
    limitador: { esperarTurno: async () => 0 },
    reloj: () => SABADO,
    fechaLocal: () => '2026-10-24',
    encolarRecalculo,
    ...extra,
  };
  return { deps, encolarRecalculo };
}

describe('ejecutarCorrida (HU-33)', () => {
  it('CA-33.1 consulta los 120 productos, guarda 120 precios y encola el recálculo', async () => {
    const repo = new RepoMemoria([sitio('WALMART'), sitio('PAIZ')], {
      'id-WALMART': vinculos('WALMART', 70),
      'id-PAIZ': vinculos('PAIZ', 50),
    });
    const { deps, encolarRecalculo } = dependencias(repo, [
      adaptadorSimulado('WALMART'),
      adaptadorSimulado('PAIZ'),
    ]);

    const r = await ejecutarCorrida(deps);

    expect(r.estado).toBe('COMPLETADA');
    expect(repo.precios).toHaveLength(120);
    expect(repo.precios.every((p) => p.fecha === '2026-10-24' && p.precio === '10.00')).toBe(true);
    expect(r.sitios).toEqual([
      { codigo: 'WALMART', estado: 'COMPLETADA', ok: 70, fallidos: 0 },
      { codigo: 'PAIZ', estado: 'COMPLETADA', ok: 50, fallidos: 0 },
    ]);
    expect(repo.corridas[0]!.totales).toEqual({ consultados: 120, actualizados: 120, fallidos: 0 });
    expect(encolarRecalculo).toHaveBeenCalledWith(r.corridaId);
  });

  it('CA-33.2 respeta 1 solicitud por segundo: nunca dos a Walmart con menos de 1 s', async () => {
    let t = 0;
    const reloj: Reloj = {
      ahora: () => t,
      dormir: async (ms) => {
        t += ms;
      },
    };
    const instantes: number[] = [];
    const walmart = adaptadorSimulado('WALMART', () => {
      instantes.push(t);
      return '10.00';
    });
    const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 70) });
    const { deps } = dependencias(repo, [walmart], {
      limitador: new LimitadorPorSitio(1000, reloj),
    });

    await ejecutarCorrida(deps);

    expect(instantes).toHaveLength(70);
    const huecos = instantes.slice(1).map((x, i) => x - instantes[i]!);
    expect(Math.min(...huecos)).toBeGreaterThanOrEqual(1000);
    // 70 solicitudes necesitan 69 intervalos: la consulta no puede durar menos de 69 s.
    expect(instantes[69]! - instantes[0]!).toBeGreaterThanOrEqual(69_000);
  });

  it('CA-33.3 con la ruta de productos prohibida no consulta Paiz y avisa que quedó bloqueado', async () => {
    const repo = new RepoMemoria([sitio('WALMART'), sitio('PAIZ')], {
      'id-WALMART': vinculos('WALMART', 3),
      'id-PAIZ': vinculos('PAIZ', 4),
    });
    const paiz = adaptadorSimulado('PAIZ');
    const { deps, encolarRecalculo } = dependencias(repo, [adaptadorSimulado('WALMART'), paiz], {
      obtenerRobots: async (origen) =>
        origen.includes('paiz')
          ? { estado: 'OK', texto: 'User-agent: *\nDisallow: /producto/\n' }
          : { estado: 'OK', texto: 'User-agent: *\nDisallow:\n' },
    });

    const r = await ejecutarCorrida(deps);

    expect(paiz.llamadas).toEqual([]);
    expect(r.sitios.find((s) => s.codigo === 'PAIZ')).toMatchObject({ estado: 'BLOQUEADO' });
    expect(repo.errores).toEqual([
      expect.objectContaining({ tipo: 'ROBOTS', mensaje: 'Bloqueado por robots.txt' }),
    ]);
    expect(repo.avisos).toEqual([
      expect.objectContaining({ mensaje: 'Paiz bloqueado: registra precios manualmente' }),
    ]);
    // Los precios de Paiz no se tocan y Walmart sí se guardó: la corrida queda parcial.
    expect(repo.precios.filter((p) => p.vinculoId.startsWith('PAIZ'))).toEqual([]);
    expect(r.estado).toBe('PARCIAL');
    expect(encolarRecalculo).toHaveBeenCalledTimes(1);
  });

  it('CA-33.4 un sitio no habilitado no se consulta y se registra "Sitio no habilitado"', async () => {
    const repo = new RepoMemoria([sitio('WALMART'), sitio('LA_TORRE', { habilitado: false })], {
      'id-WALMART': vinculos('WALMART', 2),
      'id-LA_TORRE': vinculos('LA_TORRE', 15),
    });
    const torre = adaptadorSimulado('LA_TORRE');
    const { deps } = dependencias(repo, [adaptadorSimulado('WALMART'), torre]);

    const r = await ejecutarCorrida(deps);

    expect(torre.llamadas).toEqual([]);
    expect(repo.sitiosAbiertos.find((s) => s.codigo === 'LA_TORRE')).toMatchObject({
      estado: 'NO_HABILITADO',
      totalVinculos: 15,
    });
    expect(r.sitios.find((s) => s.codigo === 'LA_TORRE')?.estado).toBe('NO_HABILITADO');
    expect(r.estado).toBe('COMPLETADA');
  });

  it('CA-33.5 con una corrida en curso la nueva se registra "Omitida" y no consulta nada', async () => {
    const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 2) });
    repo.enCurso = true;
    const walmart = adaptadorSimulado('WALMART');
    const { deps, encolarRecalculo } = dependencias(repo, [walmart]);

    const r = await ejecutarCorrida(deps, { disparo: 'MANUAL' });

    expect(r).toMatchObject({ estado: 'OMITIDA', sitios: [] });
    expect(repo.corridas[0]!.estado).toBe('OMITIDA');
    expect(walmart.llamadas).toEqual([]);
    expect(repo.precios).toEqual([]);
    expect(encolarRecalculo).not.toHaveBeenCalled();
  });

  describe('permisos (D-07, R-03)', () => {
    it('sin permiso de extracción el sitio queda bloqueado y no se consulta', async () => {
      const repo = new RepoMemoria([sitio('WALMART', { extraccionPermitida: false })], {
        'id-WALMART': vinculos('WALMART', 2),
      });
      const walmart = adaptadorSimulado('WALMART');
      const obtenerRobots = vi.fn(robotsLibre);
      const { deps } = dependencias(repo, [walmart], { obtenerRobots });

      const r = await ejecutarCorrida(deps);

      expect(walmart.llamadas).toEqual([]);
      expect(obtenerRobots).not.toHaveBeenCalled();
      expect(r.sitios[0]!.estado).toBe('BLOQUEADO');
      expect(repo.avisos[0]!.mensaje).toBe('Walmart bloqueado: registra precios manualmente');
      expect(r.estado).toBe('FALLIDA');
    });

    it('con el interruptor de entorno apagado el sitio tampoco se consulta', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 2) });
      const walmart = adaptadorSimulado('WALMART');
      const { deps } = dependencias(repo, [walmart], { sitioEncendido: () => false });
      const r = await ejecutarCorrida(deps);
      expect(walmart.llamadas).toEqual([]);
      expect(r.sitios[0]!.estado).toBe('BLOQUEADO');
    });

    it('un sitio sin adaptador (sin lector todavía) queda como no habilitado', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 2) });
      const { deps } = dependencias(repo, []);
      const r = await ejecutarCorrida(deps);
      expect(r.sitios[0]!.estado).toBe('NO_HABILITADO');
      expect(repo.avisos).toEqual([]);
    });

    it('si robots.txt no se puede descargar (5xx o sin red) el sitio se bloquea', async () => {
      const repo = new RepoMemoria([sitio('PAIZ')], { 'id-PAIZ': vinculos('PAIZ', 2) });
      const paiz = adaptadorSimulado('PAIZ');
      const { deps } = dependencias(repo, [paiz], {
        obtenerRobots: async () => ({ estado: 'ERROR', motivo: 'HTTP 503' }),
      });
      const r = await ejecutarCorrida(deps);
      expect(paiz.llamadas).toEqual([]);
      expect(r.sitios[0]!.estado).toBe('BLOQUEADO');
    });

    it('si el sitio no publica robots.txt (404) no hay restricción y se consulta', async () => {
      const repo = new RepoMemoria([sitio('PAIZ')], { 'id-PAIZ': vinculos('PAIZ', 2) });
      const { deps } = dependencias(repo, [adaptadorSimulado('PAIZ')], {
        obtenerRobots: async () => ({ estado: 'NO_EXISTE' }),
      });
      const r = await ejecutarCorrida(deps);
      expect(r.estado).toBe('COMPLETADA');
      expect(repo.precios).toHaveLength(2);
    });

    it('si solo algunas rutas están prohibidas, esas se omiten y las demás se consultan', async () => {
      const repo = new RepoMemoria([sitio('PAIZ')], { 'id-PAIZ': vinculos('PAIZ', 4) });
      const paiz = adaptadorSimulado('PAIZ');
      const { deps } = dependencias(repo, [paiz], {
        obtenerRobots: async () => ({
          estado: 'OK',
          texto: 'User-agent: *\nDisallow: /producto/PAIZ-3\n',
        }),
      });
      const r = await ejecutarCorrida(deps);
      expect(paiz.llamadas).toEqual(['PAIZ-0', 'PAIZ-1', 'PAIZ-2']);
      expect(repo.errores).toEqual([
        expect.objectContaining({ vinculoId: 'PAIZ-3', tipo: 'ROBOTS' }),
      ]);
      expect(r.sitios[0]).toEqual({ codigo: 'PAIZ', estado: 'PARCIAL', ok: 3, fallidos: 1 });
    });

    it('un vínculo sin ruta determinable se trata como no permitido', async () => {
      const repo = new RepoMemoria([sitio('PAIZ')], { 'id-PAIZ': vinculos('PAIZ', 2) });
      const paiz = adaptadorSimulado('PAIZ', undefined, () => null as unknown as string);
      const { deps } = dependencias(repo, [paiz]);
      const r = await ejecutarCorrida(deps);
      expect(paiz.llamadas).toEqual([]);
      expect(r.sitios[0]!.estado).toBe('BLOQUEADO');
    });
  });

  describe('fallas (RF-38, CU-09.3)', () => {
    it('reintenta hasta 2 veces y guarda el precio si algún intento funciona', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 1) });
      const esperarTurno = vi.fn().mockResolvedValue(0);
      const walmart = adaptadorSimulado('WALMART', (_v, intento) =>
        intento < 3 ? new ErrorExtraccion('TIEMPO_AGOTADO', 'tardó demasiado') : '12.50',
      );
      const { deps } = dependencias(repo, [walmart], { limitador: { esperarTurno } });

      const r = await ejecutarCorrida(deps);

      expect(walmart.llamadas).toHaveLength(INTENTOS_POR_PRODUCTO);
      // Cada intento también respeta el límite de 1 solicitud por segundo.
      expect(esperarTurno).toHaveBeenCalledTimes(INTENTOS_POR_PRODUCTO);
      expect(repo.precios).toEqual([
        { vinculoId: 'WALMART-0', precio: '12.50', fecha: '2026-10-24' },
      ]);
      expect(r.estado).toBe('COMPLETADA');
    });

    it('tras 3 intentos fallidos registra el error y no guarda ningún precio', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 1) });
      const { deps, encolarRecalculo } = dependencias(repo, [
        adaptadorSimulado('WALMART', () => new ErrorExtraccion('HTTP', 'HTTP 500')),
      ]);
      const r = await ejecutarCorrida(deps);
      expect(repo.precios).toEqual([]);
      expect(repo.errores).toEqual([
        { vinculoId: 'WALMART-0', tipo: 'HTTP', mensaje: 'HTTP 500', intentos: 3 },
      ]);
      expect(r.sitios[0]).toMatchObject({ estado: 'FALLIDA', ok: 0, fallidos: 1 });
      expect(r.estado).toBe('FALLIDA');
      expect(encolarRecalculo).not.toHaveBeenCalled();
    });

    it('un precio no interpretable no se guarda ni se reintenta', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], {
        'id-WALMART': vinculos('WALMART', 3),
      });
      const walmart = adaptadorSimulado('WALMART', (v) =>
        v.id === 'WALMART-1' ? 'precio no disponible' : '10.00',
      );
      // El adaptador entrega texto; la corrida lo valida con precioLeido a través del adaptador real.
      const envuelto: AdaptadorSitio = {
        ...walmart,
        rutaProducto: walmart.rutaProducto,
        consultar: async (v) => precioLeido(await walmart.consultar(v)),
      };
      const { deps } = dependencias(repo, [envuelto]);
      const r = await ejecutarCorrida(deps);
      expect(walmart.llamadas.filter((id) => id === 'WALMART-1')).toHaveLength(1);
      expect(repo.precios.map((p) => p.vinculoId)).toEqual(['WALMART-0', 'WALMART-2']);
      expect(repo.errores[0]).toMatchObject({
        vinculoId: 'WALMART-1',
        tipo: 'PRECIO_INVALIDO',
        intentos: 1,
      });
      expect(r.sitios[0]).toMatchObject({ estado: 'PARCIAL', ok: 2, fallidos: 1 });
    });

    it('un error que no es de extracción se registra como OTRO', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 1) });
      const { deps } = dependencias(repo, [
        adaptadorSimulado('WALMART', () => {
          throw new TypeError('algo se rompió');
        }),
      ]);
      await ejecutarCorrida(deps);
      expect(repo.errores[0]).toMatchObject({ tipo: 'OTRO', mensaje: 'algo se rompió' });
    });

    it('corta el sitio cuando falla más de la mitad (estructura cambiada)', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], { 'id-WALMART': vinculos('WALMART', 20) });
      const walmart = adaptadorSimulado('WALMART', (v) =>
        Number(v.id.split('-')[1]) < 1 ? '10.00' : new ErrorExtraccion('ESTRUCTURA', 'cambió'),
      );
      const { deps } = dependencias(repo, [walmart]);

      const r = await ejecutarCorrida(deps);

      expect(r.sitios[0]!.estado).toBe('DETENIDO');
      expect(repo.cierreDe('WALMART').detenidoPorEstructura).toBe(true);
      // Se detuvo apenas pasó la mitad (5 productos), sin consultar los 20.
      expect(new Set(walmart.llamadas).size).toBeLessThan(20);
      expect(r.estado).toBe('PARCIAL');
    });

    it('E2 si la base de datos falla, la corrida queda "Fallida" y el error sube', async () => {
      const repo = new RepoMemoria([sitio('WALMART')], {});
      const original = repo.sitios.bind(repo);
      repo.sitios = async () => {
        repo.falla = true;
        return original();
      };
      const { deps } = dependencias(repo, [adaptadorSimulado('WALMART')]);
      await expect(ejecutarCorrida(deps)).rejects.toThrow('sin conexión');
      expect(repo.corridas[0]!.estado).toBe('FALLIDA');
    });
  });

  it('un sitio sin vínculos termina completado sin consultar nada', async () => {
    const repo = new RepoMemoria([sitio('WALMART')], {});
    const { deps, encolarRecalculo } = dependencias(repo, [adaptadorSimulado('WALMART')]);
    const r = await ejecutarCorrida(deps);
    expect(r.estado).toBe('COMPLETADA');
    expect(r.sitios[0]).toEqual({ codigo: 'WALMART', estado: 'COMPLETADA', ok: 0, fallidos: 0 });
    expect(encolarRecalculo).not.toHaveBeenCalled();
  });
});
