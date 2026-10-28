import {
  aplicarDecisiones,
  completarSugerencias,
  esAutomatica,
  propuestaDe,
  textoPendientes,
  type NombreImportado,
} from './importaciones.platillos';

const nombre = (parcial: Partial<NombreImportado>): NombreImportado => ({
  id: 'x',
  importacionId: 'i1',
  nombreOriginal: 'Hilachas',
  nombreNormalizado: 'hilachas',
  platilloSugeridoId: null,
  similitud: null,
  decision: 'PENDIENTE',
  platilloId: null,
  nombreFinal: null,
  proteinaPrincipal: null,
  ...parcial,
});
const CATALOGO = {
  activos: new Set(['p1', 'p2']),
  ocupados: new Set(['sopa', 'tortitas de carne']),
};
const TORTAS = nombre({
  nombreOriginal: 'Tortas de carne',
  nombreNormalizado: 'tortas de carne',
  platilloSugeridoId: 'p2',
  similitud: '0.8500',
});

describe('Propuesta de platillos al importar (CU-04.3)', () => {
  it('propone asociar desde el umbral de 80 % y crear por debajo', () => {
    expect(propuestaDe(TORTAS)).toEqual({ accion: 'ASOCIAR', platilloId: 'p2', similitud: 0.85 });
    expect(propuestaDe({ ...TORTAS, similitud: '0.8000' }).accion).toBe('ASOCIAR');
    expect(propuestaDe({ ...TORTAS, similitud: '0.7999' })).toEqual({
      accion: 'CREAR',
      platilloId: null,
      similitud: 0.7999,
    });
    expect(propuestaDe(nombre({}))).toEqual({ accion: 'CREAR', platilloId: null, similitud: null });
  });
  it('marca los nombres exactos con similitud 1 y completa la mejor sugerencia del resto', () => {
    const [exacto, parecido, nuevo] = completarSugerencias(
      [
        { nombreNormalizado: 'sopa', platilloId: 'p1' },
        { nombreNormalizado: 'tortas de carne', platilloId: null },
        { nombreNormalizado: 'hilachas', platilloId: null },
      ],
      new Map([
        ['tortas de carne', { platilloId: 'p2', similitud: 0.85 }],
        ['hilachas', { platilloId: 'p1', similitud: 0 }],
      ]),
    );
    expect(exacto).toMatchObject({ platilloSugeridoId: 'p1', similitud: '1.0000' });
    expect(parecido).toMatchObject({ platilloSugeridoId: 'p2', similitud: '0.8500' });
    expect(nuevo).toMatchObject({ platilloSugeridoId: null, similitud: null });
    expect(esAutomatica({ decision: 'ASOCIAR', similitud: '1.0000' })).toBe(true);
    expect(esAutomatica({ decision: 'ASOCIAR', similitud: '0.8500' })).toBe(false);
  });
  it('redacta cuántos platillos faltan', () => {
    expect(textoPendientes(1)).toBe('Falta 1 platillo por resolver');
    expect(textoPendientes(2)).toBe('Faltan 2 platillos por resolver');
  });
});

describe('Validación de decisiones sobre platillos', () => {
  it('"aceptar todas" asocia lo parecido, crea lo demás y no toca lo ya resuelto', () => {
    const resuelto = nombre({
      nombreNormalizado: 'sopa',
      nombreOriginal: 'Sopa',
      decision: 'ASOCIAR',
      platilloId: 'p1',
      similitud: '1.0000',
    });
    const cambios = aplicarDecisiones(
      [TORTAS, nombre({}), resuelto],
      { aceptarPropuestas: true },
      CATALOGO,
    );
    expect([...cambios]).toEqual([
      ['tortas de carne', { decision: 'ASOCIAR', platilloId: 'p2', nombreFinal: null }],
      ['hilachas', { decision: 'CREAR', platilloId: null, nombreFinal: null }],
    ]);
  });
  it('las decisiones explícitas ganan sobre las propuestas y limpian el nombre corregido', () => {
    const cambios = aplicarDecisiones(
      [TORTAS, nombre({})],
      {
        aceptarPropuestas: true,
        decisiones: [
          { nombreNormalizado: 'tortas de carne', decision: 'CREAR' },
          {
            nombreNormalizado: 'hilachas',
            decision: 'CREAR',
            nombreFinal: '  Hilachas   de  res ',
          },
        ],
      },
      CATALOGO,
    );
    expect(cambios.get('tortas de carne')).toEqual({
      decision: 'CREAR',
      platilloId: null,
      nombreFinal: 'Tortas de carne',
    });
    expect(cambios.get('hilachas')?.nombreFinal).toBe('Hilachas de res');
  });
  it.each([
    ['sin decisiones', {}, 'SIN_DECISIONES'],
    [
      'nombre ajeno a la importación',
      { decisiones: [{ nombreNormalizado: 'otro', decision: 'CREAR' as const }] },
      'DECISION_INVALIDA',
    ],
    [
      'decisión repetida',
      {
        decisiones: [
          { nombreNormalizado: 'hilachas', decision: 'CREAR' as const },
          { nombreNormalizado: 'hilachas', decision: 'CREAR' as const },
        ],
      },
      'DECISION_INVALIDA',
    ],
    [
      'asociar sin platillo',
      { decisiones: [{ nombreNormalizado: 'hilachas', decision: 'ASOCIAR' as const }] },
      'DECISION_INVALIDA',
    ],
    [
      'asociar a un platillo inactivo o ajeno',
      {
        decisiones: [
          { nombreNormalizado: 'hilachas', decision: 'ASOCIAR' as const, platilloId: 'ajeno' },
        ],
      },
      'DECISION_INVALIDA',
    ],
    [
      'nombre final vacío',
      {
        decisiones: [
          { nombreNormalizado: 'hilachas', decision: 'CREAR' as const, nombreFinal: '   ' },
        ],
      },
      'DECISION_INVALIDA',
    ],
    [
      'nombre final de más de 80 caracteres',
      {
        decisiones: [
          {
            nombreNormalizado: 'hilachas',
            decision: 'CREAR' as const,
            nombreFinal: 'a'.repeat(81),
          },
        ],
      },
      'DECISION_INVALIDA',
    ],
    [
      'nombre final que ya usa el catálogo',
      {
        decisiones: [
          { nombreNormalizado: 'hilachas', decision: 'CREAR' as const, nombreFinal: 'SOPA' },
        ],
      },
      'NOMBRE_EN_USO',
    ],
  ])('rechaza %s', (_caso, datos, codigo) => {
    expect(() => aplicarDecisiones([nombre({})], datos, CATALOGO)).toThrow(
      expect.objectContaining({ codigo }),
    );
  });
  it('rechaza dos platillos nuevos con el mismo nombre', () => {
    expect(() =>
      aplicarDecisiones(
        [nombre({}), nombre({ nombreOriginal: 'Hilachas!', nombreNormalizado: 'hilachas!' })],
        {
          decisiones: [
            { nombreNormalizado: 'hilachas', decision: 'CREAR' },
            { nombreNormalizado: 'hilachas!', decision: 'CREAR', nombreFinal: 'HILACHAS' },
          ],
        },
        CATALOGO,
      ),
    ).toThrow(expect.objectContaining({ codigo: 'NOMBRE_DUPLICADO' }));
  });
  it('no permite cambiar un nombre asociado automáticamente', () => {
    const exacto = nombre({
      decision: 'ASOCIAR',
      platilloId: 'p1',
      similitud: '1.0000',
    });
    expect(() =>
      aplicarDecisiones(
        [exacto],
        { decisiones: [{ nombreNormalizado: 'hilachas', decision: 'CREAR' }] },
        CATALOGO,
      ),
    ).toThrow(expect.objectContaining({ codigo: 'DECISION_INVALIDA' }));
  });
});
