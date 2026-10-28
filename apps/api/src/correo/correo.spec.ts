import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearServicioCorreo } from './correo.module';
import { ServicioCorreoMemoria } from './memoria-correo.service';
import { correoInvitacion, escaparHtml, fechaGuatemala } from './plantillas/invitacion';
import { opcionesTransporte, ServicioCorreoSmtp, TIEMPOS_SMTP_MS } from './smtp-correo.service';

const SMTP = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'cuenta@gmail.com',
  pass: 'abcd efgh ijkl mnop',
  from: 'Menú Familiar <cuenta@gmail.com>',
};

/** ConfigService de prueba que solo lee los valores dados (no `process.env`). */
function config(valores: Record<string, unknown>): ConfigService {
  return {
    get: (clave: string) => valores[clave],
    getOrThrow: (clave: string) => {
      if (valores[clave] === undefined) throw new Error(clave);
      return valores[clave];
    },
  } as unknown as ConfigService;
}

describe('correo', () => {
  describe('ServicioCorreoSmtp', () => {
    it('Gmail 587: STARTTLS obligatorio, autenticación y tiempos límite', () => {
      expect(opcionesTransporte(SMTP)).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: SMTP.user, pass: SMTP.pass },
        connectionTimeout: TIEMPOS_SMTP_MS.conexion,
        greetingTimeout: TIEMPOS_SMTP_MS.saludo,
        socketTimeout: TIEMPOS_SMTP_MS.socket,
      });
    });

    it('465: TLS implícito', () => {
      expect(opcionesTransporte({ ...SMTP, port: 465 })).toMatchObject({
        secure: true,
        requireTLS: false,
      });
    });

    it('envía con remitente SMTP_FROM, texto y HTML', async () => {
      const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
      const fabrica = jest.fn().mockReturnValue({ sendMail });
      const servicio = new ServicioCorreoSmtp(SMTP, fabrica);
      await servicio.enviar({ para: 'ana@correo.com', asunto: 'A', html: '<p>h</p>', texto: 't' });
      expect(fabrica).toHaveBeenCalledWith(opcionesTransporte(SMTP));
      expect(sendMail).toHaveBeenCalledWith({
        from: SMTP.from,
        to: 'ana@correo.com',
        subject: 'A',
        text: 't',
        html: '<p>h</p>',
      });
    });

    it('propaga el error del proveedor', async () => {
      const sendMail = jest.fn().mockRejectedValue(new Error('535 auth'));
      const servicio = new ServicioCorreoSmtp(SMTP, () => ({ sendMail }));
      await expect(
        servicio.enviar({ para: 'a@b.c', asunto: 'x', html: 'x', texto: 'x' }),
      ).rejects.toThrow('535 auth');
    });

    it('sin fábrica usa nodemailer (no conecta hasta enviar)', () => {
      expect(() => new ServicioCorreoSmtp(SMTP)).not.toThrow();
    });
  });

  describe('ServicioCorreoMemoria', () => {
    it('guarda los mensajes, devuelve el último y puede simular una falla', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const memoria = new ServicioCorreoMemoria();
      await memoria.enviar({ para: 'ana@correo.com', asunto: '1', html: '', texto: 'uno' });
      await memoria.enviar({ para: 'luis@correo.com', asunto: '2', html: '', texto: 'dos' });
      expect(memoria.ultimo()?.asunto).toBe('2');
      expect(memoria.ultimo('ana@correo.com')?.asunto).toBe('1');
      expect(log).toHaveBeenCalledTimes(2);
      memoria.fallarSiguiente = true;
      await expect(
        memoria.enviar({ para: 'x@y.z', asunto: '3', html: '', texto: '' }),
      ).rejects.toThrow(/simulado/);
      expect(memoria.enviados).toHaveLength(2);
      memoria.limpiar();
      expect(memoria.enviados).toHaveLength(0);
      log.mockRestore();
    });

    it('en pruebas no escribe en el log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      await new ServicioCorreoMemoria(false).enviar({
        para: 'a',
        asunto: 'b',
        html: '',
        texto: '',
      });
      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe('crearServicioCorreo', () => {
    it('sin SMTP_HOST usa la memoria; en producción avisa en el log', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      expect(crearServicioCorreo(config({ NODE_ENV: 'test' }))).toBeInstanceOf(
        ServicioCorreoMemoria,
      );
      expect(warn).not.toHaveBeenCalled();
      expect(
        crearServicioCorreo(config({ NODE_ENV: 'production', SMTP_HOST: ' ' })),
      ).toBeInstanceOf(ServicioCorreoMemoria);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('con SMTP_HOST usa SMTP', () => {
      const servicio = crearServicioCorreo(
        config({
          SMTP_HOST: SMTP.host,
          SMTP_PORT: 587,
          SMTP_USER: SMTP.user,
          SMTP_PASS: SMTP.pass,
          SMTP_FROM: SMTP.from,
        }),
      );
      expect(servicio).toBeInstanceOf(ServicioCorreoSmtp);
    });
  });

  describe('plantilla de invitación', () => {
    const venceEn = new Date('2026-10-29T15:00:00.000Z');
    const mensaje = correoInvitacion({
      para: 'ana@correo.com',
      hogarNombre: 'Familia <Rosales>',
      invitadoPor: 'Rene',
      enlace: 'https://menu.duckdns.org/invitacion/abc_123',
      venceEn,
    });

    it('CA-02.1 trae el enlace y la vigencia de 7 días en texto y HTML', () => {
      expect(mensaje.para).toBe('ana@correo.com');
      expect(mensaje.asunto).toBe('Rene te invitó a Familia <Rosales> en Menú Familiar');
      expect(mensaje.texto).toContain('https://menu.duckdns.org/invitacion/abc_123');
      expect(mensaje.texto).toContain('vence en 7 días');
      expect(mensaje.texto).toContain(fechaGuatemala(venceEn));
      expect(mensaje.html).toContain('href="https://menu.duckdns.org/invitacion/abc_123"');
      expect(mensaje.html).toContain('Aceptar invitación');
      expect(mensaje.html).toContain('lang="es"');
    });

    it('escapa el HTML de los nombres', () => {
      expect(mensaje.html).toContain('Familia &lt;Rosales&gt;');
      expect(mensaje.html).not.toContain('<Rosales>');
      expect(escaparHtml(`a&b"c'd`)).toBe('a&amp;b&quot;c&#39;d');
    });

    it('fecha en hora de Guatemala', () => {
      expect(fechaGuatemala(venceEn)).toMatch(/29 de octubre de 2026/);
      expect(fechaGuatemala(venceEn)).toMatch(/9:00/);
    });
  });
});
