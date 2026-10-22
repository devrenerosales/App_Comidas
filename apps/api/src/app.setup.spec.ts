import { Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp, PREFIJO_API } from './app.setup';

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
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ CORS_ORIGIN: 'http://a.test, http://b.test' })],
        }),
      ],
      controllers: [PingController],
    }).compile();
    const app = configurarApp(moduleRef.createNestApplication());
    await app.init();

    expect(PREFIJO_API).toBe('api/v1');
    const res = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', 'http://b.test')
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['access-control-allow-origin']).toBe('http://b.test');
    await app.close();
  });
});
