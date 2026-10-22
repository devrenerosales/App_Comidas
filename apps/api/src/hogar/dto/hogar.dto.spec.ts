import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { crearErrorValidacion } from '../../comun/validacion';
import { InvitarDto, NombreHogarDto } from './hogar.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: crearErrorValidacion,
});
const validar = (metatype: ArgumentMetadata['metatype'], valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype });

describe('DTO del hogar', () => {
  it('NombreHogarDto recorta y une espacios', async () => {
    await expect(validar(NombreHogarDto, { nombre: '  Familia   Rosales ' })).resolves.toEqual({
      nombre: 'Familia Rosales',
    });
  });

  it('NombreHogarDto vacío, no texto o largo → 422 NOMBRE_HOGAR_INVALIDO', async () => {
    for (const nombre of ['   ', 5, 'x'.repeat(81)]) {
      await expect(validar(NombreHogarDto, { nombre })).rejects.toMatchObject({
        status: 422,
        codigo: 'NOMBRE_HOGAR_INVALIDO',
      });
    }
  });

  it('InvitarDto normaliza el correo y exige correo solo por CORREO', async () => {
    await expect(
      validar(InvitarDto, { medio: 'CORREO', correo: ' Ana@Correo.com ' }),
    ).resolves.toMatchObject({ medio: 'CORREO', correo: 'ana@correo.com' });
    await expect(validar(InvitarDto, { medio: 'ENLACE' })).resolves.toMatchObject({
      medio: 'ENLACE',
    });
    await expect(validar(InvitarDto, { medio: 'CORREO' })).rejects.toMatchObject({
      status: 422,
      codigo: 'CORREO_INVALIDO',
    });
    await expect(validar(InvitarDto, { medio: 'FAX' })).rejects.toMatchObject({
      status: 400,
      codigo: 'VALIDACION',
    });
  });
});
