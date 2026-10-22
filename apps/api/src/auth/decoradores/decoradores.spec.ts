import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICO } from '../auth.constants';
import { Publico } from './publico.decorator';
import { extraerUsuarioActual } from './usuario-actual.decorator';

describe('decoradores de autenticación', () => {
  it('@Publico() marca la ruta con el metadato esPublico', () => {
    class Controlador {
      @Publico()
      ruta() {
        return 1;
      }
    }
    expect(new Reflector().get(ES_PUBLICO, Controlador.prototype.ruta)).toBe(true);
  });

  it('@UsuarioActual() devuelve el usuario o uno de sus campos', () => {
    const usuario = { id: 'u1', hogarId: null, rol: null };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
    } as unknown as ExecutionContext;
    expect(extraerUsuarioActual(undefined, ctx)).toBe(usuario);
    expect(extraerUsuarioActual('id', ctx)).toBe('u1');
    const sinUsuario = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(extraerUsuarioActual('id', sinUsuario)).toBeUndefined();
  });
});
