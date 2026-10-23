import { ArgumentMetadata, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { crearErrorValidacion } from '../comun/validacion';
import type { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { AdminSistemaGuard } from './admin-sistema.guard';
import {
  ConsultaPlatillosDto,
  ConsultaProductosDto,
  ConsultaVistaPreviaDto,
  CrearProductoDto,
  DatosPlatilloDto,
  IngredientesDto,
} from './dto/catalogo.dto';
import { desplazamiento, paginar, patronContiene } from './paginacion';
import { PlatillosController } from './platillos.controller';
import type { PlatillosService } from './platillos.service';
import { CatalogosController, ProductosController } from './productos.controller';
import type { ProductosService } from './productos.service';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: crearErrorValidacion,
});
const validar = (
  metatype: ArgumentMetadata['metatype'],
  valor: unknown,
  type: 'body' | 'query' = 'body',
) => pipe.transform(valor, { type, metatype });
const UUID = '3f1c2b9e-8d7a-4c6b-9e5f-1a2b3c4d5e6f';

describe('paginación (api-contrato §1.3)', () => {
  it('desplazamiento, totalPaginas y patrón LIKE escapado', () => {
    expect(desplazamiento(3, 20)).toBe(40);
    expect(paginar(['a'], 1, 20, 41).paginacion).toEqual({
      pagina: 1,
      tamano: 20,
      total: 41,
      totalPaginas: 3,
    });
    expect(patronContiene('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
  });
});

describe('AdminSistemaGuard (D-05)', () => {
  const contexto = (usuario?: { id: string }) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ usuario }) }) }) as unknown as ExecutionContext;
  const guard = (esAdminSistema?: boolean) =>
    new AdminSistemaGuard({
      buscarPorId: jest
        .fn()
        .mockResolvedValue(esAdminSistema === undefined ? undefined : { esAdminSistema }),
    } as unknown as UsuariosRepositorio);

  it('deja pasar al administrador del sistema', async () => {
    await expect(guard(true).canActivate(contexto({ id: 'u1' }))).resolves.toBe(true);
  });

  it('403 SOLO_ADMIN_SISTEMA para miembros, usuarios inexistentes o sin sesión', async () => {
    for (const [g, c] of [
      [guard(false), contexto({ id: 'u1' })],
      [guard(undefined), contexto({ id: 'u1' })],
      [guard(true), contexto()],
    ] as const) {
      await expect(g.canActivate(c)).rejects.toMatchObject({
        status: 403,
        codigo: 'SOLO_ADMIN_SISTEMA',
      });
    }
  });
});

describe('DTO del catálogo', () => {
  it('ConsultaProductosDto aplica valores por defecto y convierte números', async () => {
    await expect(
      validar(ConsultaProductosDto, { pagina: '2', q: '' }, 'query'),
    ).resolves.toMatchObject({
      pagina: 2,
      tamano: 20,
      activo: 'true',
      q: undefined,
    });
    await expect(validar(ConsultaProductosDto, { tamano: '101' }, 'query')).rejects.toMatchObject({
      status: 400,
    });
    await expect(validar(ConsultaProductosDto, { tipo: 'OTRO' }, 'query')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('ConsultaPlatillosDto valida tiempo, proteína, ingrediente y estado', async () => {
    await expect(
      validar(ConsultaPlatillosDto, { tiempo: 'ALMUERZO', proteina: 'POLLO' }, 'query'),
    ).resolves.toMatchObject({
      estado: 'ACTIVO',
    });
    for (const consulta of [
      { tiempo: 'MERIENDA' },
      { proteina: 'TOFU' },
      { ingrediente: 'x' },
      { estado: 'X' },
    ]) {
      await expect(validar(ConsultaPlatillosDto, consulta, 'query')).rejects.toMatchObject({
        status: 400,
      });
    }
  });

  it('CrearProductoDto acepta la presentación como número y la guarda como texto', async () => {
    const dto = await validar(CrearProductoDto, {
      nombre: 'Arroz',
      tipo: 'DESPENSA',
      categoriaId: UUID,
      unidadCompra: 'bolsa',
      presentacionCantidad: 2,
      presentacionUnidadId: UUID,
    });
    expect(dto).toMatchObject({ presentacionCantidad: '2' });
  });

  it('DatosPlatilloDto e IngredientesDto: tipos y forma', async () => {
    await expect(
      validar(DatosPlatilloDto, { nombre: 'A', tiempos: ['ALMUERZO'], etiquetas: ['x'] }),
    ).resolves.toBeDefined();
    await expect(validar(DatosPlatilloDto, { tiempos: 'ALMUERZO' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      validar(IngredientesDto, {
        porcionesBase: '4',
        ingredientes: [{ productoId: UUID, cantidad: 0, unidadId: UUID }],
      }),
    ).resolves.toMatchObject({ porcionesBase: 4, ingredientes: [{ cantidad: '0' }] });
    await expect(
      validar(IngredientesDto, {
        porcionesBase: 4,
        ingredientes: [{ productoId: UUID, cantidad: 'dos', unidadId: UUID }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validar(ConsultaVistaPreviaDto, { sumaFactores: '2.5' }, 'query'),
    ).resolves.toMatchObject({ sumaFactores: 2.5 });
    await expect(
      validar(ConsultaVistaPreviaDto, { sumaFactores: '0.1' }, 'query'),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('controladores del catálogo (delegan en los servicios con el hogar del guard)', () => {
  it('ProductosController y CatalogosController', async () => {
    const s = {
      listar: jest.fn().mockResolvedValue('lista'),
      obtener: jest.fn().mockResolvedValue('uno'),
      crear: jest.fn().mockResolvedValue('creado'),
      actualizar: jest.fn().mockResolvedValue('editado'),
      inactivar: jest.fn().mockResolvedValue('inactivo'),
      reactivar: jest.fn().mockResolvedValue('activo'),
      unidades: jest.fn().mockResolvedValue('unidades'),
      categorias: jest.fn().mockResolvedValue('categorias'),
    };
    const c = new ProductosController(s as unknown as ProductosService);
    const consulta = { activo: 'true' as const, pagina: 1, tamano: 20 };
    await expect(c.listar(consulta)).resolves.toBe('lista');
    await expect(c.obtener('p1')).resolves.toBe('uno');
    await expect(c.crear({} as CrearProductoDto)).resolves.toBe('creado');
    await expect(c.actualizar('p1', {})).resolves.toBe('editado');
    await expect(c.inactivar('p1', 'h1')).resolves.toBe('inactivo');
    await expect(c.reactivar('p1', 'h1')).resolves.toBe('activo');
    expect(s.inactivar).toHaveBeenCalledWith('p1', 'h1');
    const cat = new CatalogosController(s as unknown as ProductosService);
    await expect(cat.unidades()).resolves.toBe('unidades');
    await expect(cat.categorias()).resolves.toBe('categorias');
  });

  it('PlatillosController', async () => {
    const s = {
      listar: jest.fn().mockResolvedValue('lista'),
      crear: jest.fn().mockResolvedValue('creado'),
      obtener: jest.fn().mockResolvedValue('uno'),
      actualizar: jest.fn().mockResolvedValue('editado'),
      inactivar: jest.fn().mockResolvedValue('inactivo'),
      reactivar: jest.fn().mockResolvedValue('activo'),
      guardarIngredientes: jest.fn().mockResolvedValue('ingredientes'),
      vistaPrevia: jest.fn().mockResolvedValue('vista'),
    };
    const c = new PlatillosController(s as unknown as PlatillosService);
    await expect(c.listar('h1', { estado: 'ACTIVO', pagina: 1, tamano: 20 })).resolves.toBe(
      'lista',
    );
    await expect(c.crear('h1', {})).resolves.toBe('creado');
    await expect(c.obtener('h1', 'pl1')).resolves.toBe('uno');
    await expect(c.actualizar('h1', 'pl1', {})).resolves.toBe('editado');
    await expect(c.inactivar('h1', 'pl1')).resolves.toBe('inactivo');
    await expect(c.reactivar('h1', 'pl1')).resolves.toBe('activo');
    await expect(
      c.guardarIngredientes('h1', 'pl1', { porcionesBase: 4, ingredientes: [] }),
    ).resolves.toBe('ingredientes');
    await expect(c.vistaPrevia('h1', 'pl1', { sumaFactores: 2.5 })).resolves.toBe('vista');
    expect(s.vistaPrevia).toHaveBeenCalledWith('h1', 'pl1', 2.5);
  });
});
