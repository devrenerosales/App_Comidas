import { ContrasenasService } from './contrasenas.service';

describe('ContrasenasService (argon2id)', () => {
  const servicio = new ContrasenasService();

  it('CA-01.1 cifra con argon2id 19 MiB, t=2, p=1 y verifica', async () => {
    const hash = await servicio.hash('Almuerzo2026');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(servicio.verificar(hash, 'Almuerzo2026')).resolves.toBe(true);
    await expect(servicio.verificar(hash, 'almuerzo2026')).resolves.toBe(false);
  });

  it('un hash corrupto equivale a contraseña incorrecta', async () => {
    await expect(servicio.verificar('no-es-un-hash', 'Almuerzo2026')).resolves.toBe(false);
  });

  it('verificarFicticio siempre devuelve false y reutiliza su hash', async () => {
    const espia = jest.spyOn(servicio, 'hash');
    await expect(servicio.verificarFicticio('lo-que-sea1')).resolves.toBe(false);
    await expect(servicio.verificarFicticio('menu-familiar-hash-ficticio-0')).resolves.toBe(false);
    expect(espia).toHaveBeenCalledTimes(1);
  });
});
