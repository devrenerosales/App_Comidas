import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemLista, ListaCompras } from '../api/listas';
import { CompartirLista } from './CompartirLista';

const LB = { cantidad: '1', unidad: 'lb', unidadCompra: 'lb', texto: 'lb 1 lb' };

const item = (
  id: string,
  nombre: string,
  cantidad: string,
  estado: ItemLista['estado'] = 'PENDIENTE',
): ItemLista => ({
  id,
  producto: { id: `p-${id}`, nombre },
  cantidadRequerida: null,
  equivalente: null,
  cantidadComprar: cantidad,
  presentacion: LB,
  origen: 'MENU',
  estado,
  sinConversion: false,
  comidas: [],
  precioReal: estado === 'COMPRADO' ? '28.10' : null,
});

/** CA-32.1: semana del 25/10/2026 con productos pendientes y comprados. */
const lista = (items: ItemLista[]): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-10-25', hasta: '2026-10-31' },
  version: 1,
  excede: null,
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  sinConversion: 0,
  items,
});

const MEZCLADA = [
  item('a', 'Pollo en piezas', '7'),
  item('b', 'Arroz', '2', 'COMPRADO'),
  item('c', 'Tomate', '3'),
];

const TEXTO_PENDIENTES = 'Lista de compras 25/10–31/10\nPollo en piezas — 7 lb\nTomate — 3 lb';

/** Instala (o quita) lo que el navegador ofrece para compartir y copiar. */
function navegador(opciones: { share?: unknown; writeText?: unknown } = {}) {
  const poner = (propiedad: string, valor: unknown) =>
    Object.defineProperty(window.navigator, propiedad, { value: valor, configurable: true });
  poner('share', opciones.share);
  poner('clipboard', opciones.writeText ? { writeText: opciones.writeText } : undefined);
}

function montar(items: ItemLista[] = MEZCLADA) {
  const user = userEvent.setup();
  render(<CompartirLista lista={lista(items)} />);
  return user;
}

const compartir = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Compartir' }));

afterEach(() => {
  navegador();
});

describe('HU-32 Compartir la lista', () => {
  it('CA-32.1 abre el menú de compartir con el encabezado y solo los pendientes', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    navegador({ share });
    const user = montar();

    await compartir(user);

    expect(share).toHaveBeenCalledWith({ title: 'Lista de compras', text: TEXTO_PENDIENTES });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('el texto no lleva precios', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    navegador({ share });
    const user = montar();
    await user.click(screen.getByLabelText('Incluir comprados'));
    await compartir(user);
    expect(share.mock.calls[0]![0].text).toContain('Arroz — 2 lb');
    expect(share.mock.calls[0]![0].text).not.toContain('28.10');
  });

  it('CA-32.2 sin compartir nativo copia el texto y avisa "Lista copiada"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = montar();
    navegador({ writeText });

    await compartir(user);

    expect(writeText).toHaveBeenCalledWith(TEXTO_PENDIENTES);
    expect(await screen.findByRole('status')).toHaveTextContent('Lista copiada');
  });

  it('CA-32.3 con todo comprado dice "No hay productos pendientes" y ofrece incluir comprados', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const user = montar([
      item('a', 'Pollo en piezas', '7', 'COMPRADO'),
      item('b', 'Arroz', '2', 'YA_LO_TENGO'),
    ]);
    navegador({ share });

    await compartir(user);

    expect(await screen.findByRole('status')).toHaveTextContent('No hay productos pendientes');
    expect(screen.getByText(/Activa «Incluir comprados»/)).toBeVisible();
    expect(share).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Incluir comprados'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await compartir(user);
    expect(share).toHaveBeenCalledWith({
      title: 'Lista de compras',
      text: 'Lista de compras 25/10–31/10\nPollo en piezas — 7 lb\nArroz — 2 lb',
    });
  });

  it('1a incluir comprados agrega todos los productos', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    navegador({ share });
    const user = montar();
    await user.click(screen.getByLabelText('Incluir comprados'));
    await compartir(user);
    expect(share.mock.calls[0]![0].text.split('\n')).toEqual([
      'Lista de compras 25/10–31/10',
      'Pollo en piezas — 7 lb',
      'Arroz — 2 lb',
      'Tomate — 3 lb',
    ]);
  });

  it('si la persona cierra el menú de compartir no pasa nada más', async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    const user = montar();
    navegador({ share, writeText });

    await compartir(user);

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('si compartir falla por otra causa copia el texto', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockRejectedValue(new DOMException('sin permiso', 'NotAllowedError'));
    const user = montar();
    navegador({ share, writeText });

    await compartir(user);

    expect(writeText).toHaveBeenCalledWith(TEXTO_PENDIENTES);
    expect(await screen.findByRole('status')).toHaveTextContent('Lista copiada');
  });

  it('si tampoco se puede copiar muestra el texto para copiarlo a mano', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
    const user = montar();
    navegador({ writeText });

    await compartir(user);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No se pudo copiar automáticamente',
    );
    expect(screen.getByLabelText('Texto de la lista')).toHaveValue(TEXTO_PENDIENTES);
  });

  it('sin compartir ni portapapeles también muestra el texto', async () => {
    const user = montar();
    navegador();
    await compartir(user);
    expect(await screen.findByLabelText('Texto de la lista')).toHaveValue(TEXTO_PENDIENTES);
  });

  it('cambiar "Incluir comprados" quita el aviso anterior y el texto manual', async () => {
    const user = montar();
    navegador();
    await compartir(user);
    expect(await screen.findByLabelText('Texto de la lista')).toBeVisible();

    await user.click(screen.getByLabelText('Incluir comprados'));

    expect(screen.queryByLabelText('Texto de la lista')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('la lista no cambia al compartir', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = montar();
    navegador({ writeText });
    await compartir(user);
    expect(MEZCLADA.map((i) => i.estado)).toEqual(['PENDIENTE', 'COMPRADO', 'PENDIENTE']);
  });
});
