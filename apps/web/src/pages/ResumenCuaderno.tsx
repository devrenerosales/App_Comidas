import { aCentavos, formatoQuetzales } from '@menu/shared';
import type { ReporteImportacion, ResumenLista } from '../api/importaciones';

const monto = (valor: string | null) =>
  valor === null ? 'Sin precios' : formatoQuetzales(aCentavos(valor)!, true);
const tipo = (t: ResumenLista['tipo']) => (t === 'DESPENSA' ? 'Despensa' : 'Compras');

function TablaListas({ listas, titulo }: { listas: ResumenLista[]; titulo: string }) {
  return (
    <table>
      <caption>{titulo}</caption>
      <thead>
        <tr>
          <th scope="col">Lista</th>
          <th scope="col">Tipo</th>
          <th scope="col">Productos</th>
          <th scope="col">Total</th>
          <th scope="col">Nuevos en el catálogo</th>
        </tr>
      </thead>
      <tbody>
        {listas.map((l) => (
          <tr key={`${l.tipo}:${l.lista}`}>
            <th scope="row">{l.lista}</th>
            <td>{tipo(l.tipo)}</td>
            <td>{l.productos}</td>
            <td>{monto(l.total)}</td>
            <td>{l.nuevos}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Listas de la carga inicial del cuaderno antes de confirmar (HU-18). */
export function ListasPrevia({ listas }: { listas: ResumenLista[] }) {
  if (!listas.length) return null;
  return (
    <section aria-label="Listas del cuaderno">
      <h3>Listas del cuaderno</h3>
      <p>
        Los productos de despensa se registran como despensa del hogar con frecuencia mensual. Los
        que no existen se crean en el catálogo en la categoría Otros.
      </p>
      <TablaListas listas={listas} titulo="Resumen de listas por cargar" />
    </section>
  );
}

/** Reporte de conciliación para comparar con las fotos del cuaderno (CU-04.4 paso 5). */
export function ReporteConciliacion({ reporte }: { reporte: ReporteImportacion }) {
  const { gastoSemanal, listas } = reporte;
  if (!gastoSemanal && !listas.length) return null;
  return (
    <section aria-label="Reporte de conciliación">
      <h3>Reporte de conciliación</h3>
      {gastoSemanal ? (
        <dl>
          <dt>Semanas con gasto</dt>
          <dd>{gastoSemanal.semanas}</dd>
          <dt>Gasto semanal mínimo</dt>
          <dd>{monto(gastoSemanal.minimo)}</dd>
          <dt>Gasto semanal máximo</dt>
          <dd>{monto(gastoSemanal.maximo)}</dd>
          <dt>Gasto semanal promedio</dt>
          <dd>{monto(gastoSemanal.promedio)}</dd>
        </dl>
      ) : (
        <p>Ninguna de las semanas importadas trae gasto.</p>
      )}
      {!!listas.length && <TablaListas listas={listas} titulo="Listas cargadas" />}
      <p>
        Compara estas cifras con las fotos. Si alguna no coincide, corrige el archivo, vuelve a
        cargarlo y elige Reemplazar en las semanas afectadas.
      </p>
    </section>
  );
}
