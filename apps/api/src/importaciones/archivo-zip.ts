import { inflateRawSync } from 'node:zlib';
import { Problema } from '../comun/problema';

/** Comprueba el tamaño real descomprimido antes de entregar el XLSX a ExcelJS. */
export function validarContenedorXlsx(buffer: Buffer): void {
  const maximo = 32 * 1024 * 1024;
  try {
    let fin = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (
        buffer.readUInt32LE(i) === 0x06054b50 &&
        i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
      ) {
        fin = i;
        break;
      }
    }
    if (fin < 0 || buffer.readUInt16LE(fin + 4) || buffer.readUInt16LE(fin + 6))
      throw new Error('zip');
    const cantidad = buffer.readUInt16LE(fin + 10);
    if (!cantidad || cantidad > 1000) throw new Error('entradas');
    let posicion = buffer.readUInt32LE(fin + 16);
    let total = 0;
    if (posicion + buffer.readUInt32LE(fin + 12) !== fin) throw new Error('directorio');
    for (let n = 0; n < cantidad; n++) {
      if (buffer.readUInt32LE(posicion) !== 0x02014b50 || buffer.readUInt16LE(posicion + 8) & 1)
        throw new Error('zip');
      const metodo = buffer.readUInt16LE(posicion + 10);
      const comprimido = buffer.readUInt32LE(posicion + 20);
      const declarado = buffer.readUInt32LE(posicion + 24);
      if (declarado > maximo - total || comprimido === 0xffffffff) throw new Error('limite');
      const local = buffer.readUInt32LE(posicion + 42);
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('local');
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      if (inicio + comprimido > buffer.length) throw new Error('rango');
      const bloque = buffer.subarray(inicio, inicio + comprimido);
      const contenido =
        metodo === 0
          ? bloque
          : metodo === 8
            ? inflateRawSync(bloque, { maxOutputLength: Math.max(1, maximo - total) })
            : null;
      if (!contenido || contenido.length !== declarado) throw new Error('tamano');
      const nombre = buffer
        .subarray(posicion + 46, posicion + 46 + buffer.readUInt16LE(posicion + 28))
        .toString('utf8');
      if (/^xl\/worksheets\/.*\.xml$/i.test(nombre)) {
        // Evita índices dispersos enormes antes de que el lector construya sus arrays.
        const xml = contenido.toString('utf8');
        for (const atributo of xml.matchAll(
          /<(?:\w+:)?(?:row|c)\b[^>]*\br\s*=\s*["']([^"']*)["']/g,
        )) {
          const coordenada = atributo[1]!;
          if (!/^(?:[A-Z]{1,2})?[1-9]\d{0,4}$/.test(coordenada)) throw new Error('coordenada');
          const partes = /^([A-Z]*)(\d+)$/.exec(coordenada)!;
          const columna = [...partes[1]!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
          if (Number(partes[2]) > 10001 || columna > 32) throw new Error('dimensiones');
        }
      }
      total += contenido.length;
      posicion +=
        46 +
        buffer.readUInt16LE(posicion + 28) +
        buffer.readUInt16LE(posicion + 30) +
        buffer.readUInt16LE(posicion + 32);
    }
    if (posicion !== fin) throw new Error('directorio');
  } catch {
    throw new Problema(
      422,
      'XLSX_INVALIDO',
      'El archivo XLSX no es válido o supera el límite de descompresión permitido',
    );
  }
}
