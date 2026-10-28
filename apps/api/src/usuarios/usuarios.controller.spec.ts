import { AuthService } from '../auth/auth.service';
import { UsuariosController } from './usuarios.controller';

describe('UsuariosController', () => {
  it('GET /usuarios/yo consulta el perfil del usuario del token', async () => {
    const perfil = { id: 'u1', nombre: 'R', correo: 'r@c.com', esAdminSistema: false, hogar: null };
    const auth = { perfil: jest.fn().mockResolvedValue(perfil) };
    const controlador = new UsuariosController(auth as unknown as AuthService);
    await expect(controlador.yo('u1')).resolves.toBe(perfil);
    expect(auth.perfil).toHaveBeenCalledWith('u1');
  });
});
