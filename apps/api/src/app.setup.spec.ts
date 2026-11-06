import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp, confianzaProxy, PREFIJO_API } from './app.setup';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('configurarApp', () => {
  it('aplica prefijo /api/v1, Helmet y CORS con varios orígenes', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((clave: string) =>
              clave === 'CORS_ORIGIN' ? 'http://a.test, http://b.test' : undefined,
            ),
          },
        },
      ],
      controllers: [PingController],
    }).compile();
    const app = configurarApp(moduleRef.createNestApplication());
    try {
      await app.init();
      expect(PREFIJO_API).toBe('api/v1');
      const res = await request(app.getHttpServer())
        .get('/api/v1/ping')
        .set('Origin', 'http://b.test')
        .expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['access-control-allow-origin']).toBe('http://b.test');
    } finally {
      await app.close();
    }
    // Usa HTTP real: mismo margen de arranque que las pruebas de integración.
  }, 30_000);
});

describe('confianzaProxy', () => {
  it.each([
    [undefined, 'loopback, linklocal, uniquelocal'],
    ['', 'loopback, linklocal, uniquelocal'],
    ['1', 1],
    ['true', true],
    ['false', false],
    ['10.0.0.0/8, loopback', '10.0.0.0/8, loopback'],
  ])('TRUST_PROXY=%j → %j', (entrada, esperado) => {
    expect(confianzaProxy(entrada)).toBe(esperado);
  });
});
