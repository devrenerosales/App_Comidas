import type { ItemDeLista, ListaCompleta, UnidadLista } from './listas.repositorio';
import { vistaLista } from './listas.vista';

const LB: UnidadLista = { id: 'u-lb', codigo: 'lb', magnitud: 'MASA', factorBase: '453.592' };
const G: UnidadLista = { id: 'u-g', codigo: 'g', magnitud: 'MASA', factorBase: '1' };
const TAZA: UnidadLista = { id: 'u-taza', codigo: 'taza', magnitud: 'VOLUMEN', factorBase: '240' };
const CDTA: UnidadLista = {
  id: 'u-cdta',
  codigo: 'cucharadita',
  magnitud: 'VOLUMEN',
  factorBase: '5',
};

const item = (extra: Partial<ItemDeLista> = {}): ItemDeLista => ({
  id: 'i1',
  productoId: 'pollo',
  textoLibre: null,
  productoNombre: 'Pollo en piezas',
  origen: 'MENU',
  cantidadRequerida: '6.750',
  unidadRequerida: LB,
  cantidadComprar: '7.000',
  sinConversion: false,
  estado: 'PENDIENTE',
  unidadCompra: 'bolsa',
  presentacionCantidad: '1.000',
  presentacionUnidad: LB,
  equivalencia: null,
  precioReal: null,
  contenidoComprado: null,
  precioNormalizado: null,
  promedioCompra: null,
  medianaMercado: null,
  categoria: 'Carnes',
  compra: null,
  comidas: ['d1', 'd2'],
  ...extra,
});

const lista = (items: ItemDeLista[], extra: Partial<ListaCompleta> = {}): ListaCompleta => ({
  id: 'l1',
  menuId: 'm1',
  version: 1,
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  excesoAlAprobar: null,
  items,
  comidas: [],
  ...extra,
});

describe('vistaLista (CU-07.1, HU-28)', () => {
  it('CA-28.1 muestra 6.75 lb requeridas y 7 a comprar sin ceros de más', () => {
    const v = vistaLista(lista([item()]));
    expect(v).toMatchObject({
      id: 'l1',
      menuId: 'm1',
      semana: { desde: '2026-11-01', hasta: '2026-11-07' },
      version: 1,
      excede: null,
      total: 1,
      comprados: 0,
      sinConversion: 0,
    });
    expect(v.items[0]).toEqual({
      id: 'i1',
      producto: { id: 'pollo', nombre: 'Pollo en piezas' },
      cantidadRequerida: { cantidad: '6.75', unidad: 'lb' },
      equivalente: null,
      cantidadComprar: '7',
      presentacion: { cantidad: '1', unidad: 'lb', unidadCompra: 'bolsa', texto: 'bolsa 1 lb' },
      origen: 'MENU',
      estado: 'PENDIENTE',
      sinConversion: false,
      precioReal: null,
      contenidoComprado: null,
      precioNormalizado: null,
      promedioCompra: null,
      medianaMercado: null,
      categoria: 'Carnes',
      compra: null,
      comidas: ['d1', 'd2'],
    });
  });

  it('CA-28.2 800 g requeridos equivalen a 1.76 lb', () => {
    const [i] = vistaLista(
      lista([item({ cantidadRequerida: '800.000', unidadRequerida: G, cantidadComprar: '2.000' })]),
    ).items;
    expect(i).toMatchObject({
      cantidadRequerida: { cantidad: '800', unidad: 'g' },
      equivalente: { cantidad: '1.76', unidad: 'lb' },
      cantidadComprar: '2',
    });
  });

  it('usa la equivalencia registrada de otra magnitud (2 tazas → 0.9 lb)', () => {
    const [i] = vistaLista(
      lista([
        item({ cantidadRequerida: '2.000', unidadRequerida: TAZA, equivalencia: '0.450000' }),
      ]),
    ).items;
    expect(i!.equivalente).toEqual({ cantidad: '0.9', unidad: 'lb' });
  });

  it('CA-28.3 un ítem sin conversión conserva "1 cucharadita" y no tiene equivalente', () => {
    const v = vistaLista(
      lista([
        item({
          productoNombre: 'Orégano',
          cantidadRequerida: '1.000',
          unidadRequerida: CDTA,
          cantidadComprar: '1.000',
          sinConversion: true,
          presentacionCantidad: '10.000',
          presentacionUnidad: G,
          unidadCompra: 'sobre',
        }),
      ]),
    );
    expect(v.sinConversion).toBe(1);
    expect(v.items[0]).toMatchObject({
      cantidadRequerida: { cantidad: '1', unidad: 'cucharadita' },
      equivalente: null,
      sinConversion: true,
      presentacion: { texto: 'sobre 10 g' },
    });
  });

  it('sin cantidad requerida (unidades mezcladas) no devuelve cantidad ni equivalente', () => {
    const [i] = vistaLista(
      lista([item({ cantidadRequerida: null, unidadRequerida: null, sinConversion: true })]),
    ).items;
    expect(i).toMatchObject({ cantidadRequerida: null, equivalente: null });
  });

  it('un equivalente que no se puede calcular (otra magnitud sin equivalencia) se omite', () => {
    const [i] = vistaLista(
      lista([item({ unidadRequerida: TAZA, cantidadRequerida: '2.000' })]),
    ).items;
    expect(i!.equivalente).toBeNull();
  });

  it('un producto de texto libre usa su texto y no tiene presentación', () => {
    const [i] = vistaLista(
      lista([
        item({
          productoId: null,
          productoNombre: null,
          textoLibre: 'Velas',
          unidadCompra: null,
          presentacionCantidad: null,
          presentacionUnidad: null,
          cantidadRequerida: null,
          unidadRequerida: null,
          origen: 'MANUAL',
        }),
      ]),
    ).items;
    expect(i).toMatchObject({ producto: { id: null, nombre: 'Velas' }, presentacion: null });
  });

  it('un ítem sin nombre ni texto queda con nombre vacío', () => {
    const [i] = vistaLista(lista([item({ productoNombre: null, textoLibre: null })])).items;
    expect(i!.producto.nombre).toBe('');
  });

  it('HU-43 trae las comidas del menú para calcular el avance sin conexión', () => {
    const comidas = [
      {
        menuDetalleId: 'd1',
        fecha: '2026-11-04',
        tiempo: 'ALMUERZO' as const,
        platillo: { id: 'p1', nombre: 'Pepián de pollo' },
      },
    ];
    expect(vistaLista(lista([item()], { comidas })).comidas).toEqual(comidas);
  });

  it('CA-44.1 muestra el precio pagado, el promedio de compra y la mediana de mercado', () => {
    const v = vistaLista(
      lista([
        item({
          estado: 'COMPRADO',
          precioReal: '28.10',
          contenidoComprado: '2.000',
          precioNormalizado: '28.10',
          promedioCompra: { promedio: 27.2, compras: 3 },
          medianaMercado: '27.50',
        }),
      ]),
    );
    expect(v.items[0]).toMatchObject({
      precioReal: '28.10',
      contenidoComprado: '2',
      precioNormalizado: '28.10',
      promedioCompra: { precio: '27.20', compras: 3 },
      medianaMercado: '27.50',
    });
  });

  it('HU-31 lleva la categoría y la compra sugerida del producto', () => {
    const compra = {
      supermercado: { id: 's1', nombre: 'Paiz' },
      precio: '21.90',
      fecha: '2026-10-24',
      desactualizado: false,
    };
    const [i] = vistaLista(lista([item({ compra })])).items;
    expect(i).toMatchObject({ categoria: 'Carnes', compra });
  });

  it('CA-44.3 el gasto sugerido suma solo los precios reales de los ítems comprados', () => {
    const v = vistaLista(
      lista([
        item({ id: 'a', estado: 'COMPRADO', precioReal: '54.00' }),
        item({ id: 'b', estado: 'COMPRADO', precioReal: '27.00' }),
        item({ id: 'c', estado: 'COMPRADO', precioReal: '18.50' }),
        item({ id: 'd', estado: 'YA_LO_TENGO' }),
        item({ id: 'e', estado: 'COMPRADO' }),
        item({ id: 'f', estado: 'PENDIENTE' }),
      ]),
    );
    expect(v.gastoSugerido).toBe('99.50');
  });

  it('sin precios registrados el gasto sugerido es Q0.00', () => {
    expect(vistaLista(lista([item()])).gastoSugerido).toBe('0.00');
  });

  it('CA-28.6 el encabezado trae el exceso con que se aprobó y cuenta los cubiertos', () => {
    const v = vistaLista(
      lista(
        [item(), item({ id: 'i2', estado: 'COMPRADO' }), item({ id: 'i3', estado: 'YA_LO_TENGO' })],
        { excesoAlAprobar: '17.00' },
      ),
    );
    expect(v.excede).toEqual({ monto: '17.00', texto: 'Excede por Q17.00' });
    expect(v).toMatchObject({ total: 3, comprados: 2 });
  });
});
