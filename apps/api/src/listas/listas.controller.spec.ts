import type { SincronizarListaDto } from './dto/listas.dto';
import { ListasController } from './listas.controller';
import type { ListasService } from './listas.service';

describe('ListasController (HU-28, HU-30)', () => {
  const obtener = jest.fn().mockResolvedValue('lista');
  const sincronizar = jest.fn().mockResolvedValue('sincronizada');
  const avance = jest.fn().mockResolvedValue('avance');
  const controlador = new ListasController({
    obtener,
    sincronizar,
    avance,
  } as unknown as ListasService);

  it('lee la lista del hogar', async () => {
    await expect(controlador.obtener('h1', 'l1')).resolves.toBe('lista');
    expect(obtener).toHaveBeenCalledWith('h1', 'l1');
  });

  it('lee el avance de la compra por comida', async () => {
    await expect(controlador.avance('h1', 'l1')).resolves.toBe('avance');
    expect(avance).toHaveBeenCalledWith('h1', 'l1');
  });

  it('sincroniza los cambios con el usuario que los envía', async () => {
    const dto = { cambios: [] } as unknown as SincronizarListaDto;
    await expect(controlador.sincronizar('h1', 'u1', 'l1', dto)).resolves.toBe('sincronizada');
    expect(sincronizar).toHaveBeenCalledWith('h1', 'u1', 'l1', dto);
  });
});
