import { describe, expect, it } from 'vitest';
import { analizarRobots, reglasDeRespuesta } from './robots.js';

const AGENTE = 'MenuFamiliarBot/1.0 (contacto@ejemplo.com)';

describe('analizarRobots', () => {
  it('sin reglas todo está permitido', () => {
    expect(analizarRobots('', AGENTE).permitido('/producto/1')).toBe(true);
  });

  it('Disallow por prefijo prohíbe la ruta y lo que cuelga de ella', () => {
    const r = analizarRobots('User-agent: *\nDisallow: /producto/\n', AGENTE);
    expect(r.permitido('/producto/123?x=1')).toBe(false);
    expect(r.permitido('/categoria/granos')).toBe(true);
    expect(r.permitido('/producto')).toBe(true);
  });

  it('un Disallow vacío no prohíbe nada', () => {
    expect(analizarRobots('User-agent: *\nDisallow:\n', AGENTE).permitido('/x')).toBe(true);
  });

  it('gana la regla más larga y, a igual largo, Allow', () => {
    const r = analizarRobots(
      'User-agent: *\nDisallow: /producto/\nAllow: /producto/oferta/\nDisallow: /a\nAllow: /a\n',
      AGENTE,
    );
    expect(r.permitido('/producto/oferta/1')).toBe(true);
    expect(r.permitido('/producto/1')).toBe(false);
    expect(r.permitido('/abc')).toBe(true);
  });

  it('admite comodines * y el fin de ruta $', () => {
    const r = analizarRobots('User-agent: *\nDisallow: /*.json$\nDisallow: /buscar*q=\n', AGENTE);
    expect(r.permitido('/datos.json')).toBe(false);
    expect(r.permitido('/datos.json?v=1')).toBe(true);
    expect(r.permitido('/buscar?x=1&q=arroz')).toBe(false);
    expect(r.permitido('/buscar?x=1')).toBe(true);
  });

  it('el grupo de nuestro agente gana sobre el grupo *', () => {
    const texto =
      'User-agent: *\nDisallow: /\n\nUser-agent: MenuFamiliarBot\nDisallow: /privado/\n';
    const r = analizarRobots(texto, AGENTE);
    expect(r.permitido('/producto/1')).toBe(true);
    expect(r.permitido('/privado/x')).toBe(false);
  });

  it('con otro agente aplica el grupo *', () => {
    const texto = 'User-agent: OtroBot\nDisallow: /\n\nUser-agent: *\nDisallow: /carrito\n';
    const r = analizarRobots(texto, AGENTE);
    expect(r.permitido('/producto/1')).toBe(true);
    expect(r.permitido('/carrito')).toBe(false);
  });

  it('varios User-agent seguidos comparten las reglas y se ignoran comentarios y campos ajenos', () => {
    const texto =
      '# reglas\nUser-agent: OtroBot\nUser-agent: menufamiliarbot # nosotros\nCrawl-delay: 5\nDisallow: /x # no\nSitemap: https://e.com/s.xml\nlinea sin dos puntos\n';
    const r = analizarRobots(texto, AGENTE);
    expect(r.permitido('/x/1')).toBe(false);
    expect(r.permitido('/y')).toBe(true);
  });

  it('acepta saltos de línea de Windows', () => {
    expect(analizarRobots('User-agent: *\r\nDisallow: /p/\r\n', AGENTE).permitido('/p/1')).toBe(
      false,
    );
  });

  it('una regla antes de cualquier User-agent se ignora', () => {
    expect(analizarRobots('Disallow: /\n', AGENTE).permitido('/x')).toBe(true);
  });
});

describe('reglasDeRespuesta', () => {
  it('OK aplica el texto', () => {
    const r = reglasDeRespuesta({ estado: 'OK', texto: 'User-agent: *\nDisallow: /p\n' }, AGENTE);
    expect(r!.permitido('/p')).toBe(false);
  });

  it('NO_EXISTE (4xx) permite todo', () => {
    expect(reglasDeRespuesta({ estado: 'NO_EXISTE' }, AGENTE)!.permitido('/p')).toBe(true);
  });

  it('ERROR (5xx o sin red) no se puede verificar: null', () => {
    expect(reglasDeRespuesta({ estado: 'ERROR', motivo: 'HTTP 503' }, AGENTE)).toBeNull();
  });
});
