import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto, RegistroDto } from '../auth/dto/auth.dto';
import { crearErrorValidacion } from './validacion';

function validar<T extends object>(clase: new () => T, datos: object) {
  const errores = validateSync(plainToInstance(clase, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return crearErrorValidacion(errores);
}

describe('crearErrorValidacion', () => {
  it('CA-01.4 contraseña débil como única falla → 422 CONTRASENA_DEBIL', () => {
    const p = validar(RegistroDto, {
      nombre: 'Rene',
      correo: 'rene@correo.com',
      contrasena: 'pollo',
    });
    expect(p.getStatus()).toBe(422);
    expect(p.codigo).toBe('CONTRASENA_DEBIL');
    expect(p.detalle).toBe('La contraseña debe tener al menos 8 caracteres, una letra y un número');
  });

  it('varias fallas mezcladas → 400 VALIDACION con errores por campo', () => {
    const p = validar(RegistroDto, { nombre: '  ', correo: 'x', contrasena: 'pollo', extra: 1 });
    expect(p.getStatus()).toBe(400);
    expect(p.codigo).toBe('VALIDACION');
    expect(p.extensiones.errores).toEqual(
      expect.arrayContaining([
        { campo: 'nombre', mensaje: 'Ingresa tu nombre' },
        { campo: 'correo', mensaje: 'Ingresa un correo válido' },
        { campo: 'extra', mensaje: 'Este campo no está permitido' },
      ]),
    );
  });

  it('normaliza el correo del login antes de validar', () => {
    const dto = plainToInstance(LoginDto, { correo: ' A@B.COM ', contrasena: 'x' });
    expect(dto.correo).toBe('a@b.com');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('campos anidados usan la ruta con punto; sin errores → mensaje genérico', () => {
    const p = crearErrorValidacion([
      {
        property: 'padre',
        children: [{ property: 'hijo', constraints: { x: 'Falta' }, children: [] }],
      },
    ]);
    expect(p.extensiones.errores).toEqual([{ campo: 'padre.hijo', mensaje: 'Falta' }]);
    expect(crearErrorValidacion([]).detalle).toBe('Revisa los datos enviados');
  });
});
