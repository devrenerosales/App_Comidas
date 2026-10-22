import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { cuerpoProblema, Problema, tipoProblema } from './problema';
import { ProblemaFiltro } from './problema.filter';

function host(url = '/api/v1/x?y=1') {
  const res = { status: jest.fn(), type: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  const h = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ originalUrl: url }) }),
  } as unknown as ArgumentsHost;
  return { h, res };
}

describe('RFC 7807', () => {
  const filtro = new ProblemaFiltro();

  it('Problema arma type, title, status, detail, codigo y extensiones', () => {
    const p = new Problema(423, 'CUENTA_BLOQUEADA', 'Bloqueada', { bloqueadoHasta: 'x' });
    expect(p.getStatus()).toBe(423);
    expect(p.getResponse()).toEqual({
      type: 'https://menufamiliar.local/problemas/cuenta-bloqueada',
      title: 'Bloqueado temporalmente',
      status: 423,
      detail: 'Bloqueada',
      codigo: 'CUENTA_BLOQUEADA',
      bloqueadoHasta: 'x',
    });
    expect(tipoProblema('A_B')).toBe('https://menufamiliar.local/problemas/a-b');
    expect(cuerpoProblema(418, 'TETERA', 'x').title).toBe('Error');
  });

  it('responde application/problem+json con instance sin query', () => {
    const { h, res } = host();
    filtro.catch(new Problema(409, 'CORREO_REGISTRADO', 'Este correo ya tiene cuenta'), h);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    expect(JSON.parse(res.send.mock.calls[0][0])).toMatchObject({
      codigo: 'CORREO_REGISTRADO',
      instance: '/api/v1/x',
    });
  });

  it('traduce excepciones HTTP de Nest y del throttler', () => {
    expect(filtro.aCuerpo(new NotFoundException())).toMatchObject({
      status: 404,
      codigo: 'NO_ENCONTRADO',
      detail: 'El recurso solicitado no existe.',
    });
    expect(filtro.aCuerpo(new ThrottlerException())).toMatchObject({
      status: 429,
      codigo: 'LIMITE_SOLICITUDES',
    });
    expect(filtro.aCuerpo(new BadRequestException('JSON mal formado'))).toMatchObject({
      status: 400,
      codigo: 'SOLICITUD_INVALIDA',
      detail: 'JSON mal formado',
    });
    expect(filtro.aCuerpo(new HttpException('texto', 418))).toMatchObject({
      codigo: 'HTTP_418',
      detail: 'texto',
    });
    expect(filtro.aCuerpo(new HttpException({ otro: 1 }, 409))).toMatchObject({
      codigo: 'CONFLICTO',
      detail: 'Http Exception',
    });
  });

  it('errores inesperados → 500 sin filtrar detalles internos', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    expect(filtro.aCuerpo(new Error('secreto interno'))).toMatchObject({
      status: 500,
      codigo: 'ERROR_INTERNO',
      detail: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    });
    filtro.aCuerpo('cadena');
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it('usa req.url si no hay originalUrl', () => {
    const res = { status: jest.fn(), type: jest.fn(), send: jest.fn() };
    res.status.mockReturnValue(res);
    res.type.mockReturnValue(res);
    const h = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/a' }) }),
    } as unknown as ArgumentsHost;
    filtro.catch(new NotFoundException(), h);
    expect(JSON.parse(res.send.mock.calls[0][0]).instance).toBe('/a');
  });
});
