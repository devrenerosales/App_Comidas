import type { DetalleMenu } from '../api/menus';

/** Lo que la tabla y el calendario necesitan para mostrar y cambiar los espacios del menú. */
export interface AccionesMenu {
  /** Solo el Borrador se puede cambiar (CU-06.1 E2). */
  editable: boolean;
  /** Espacio cuyo platillo se está moviendo; el resto ofrece "Mover aquí". */
  moviendo: string | null;
  ocupado: boolean;
  onMotivo: (d: DetalleMenu) => void;
  onAlternativa: (d: DetalleMenu) => void;
  onCambiar: (d: DetalleMenu) => void;
  onFijar: (d: DetalleMenu) => void;
  onIniciarMover: (d: DetalleMenu) => void;
  onMover: (origenId: string, destinoId: string) => void;
}

/** Atributos para arrastrar el platillo de un espacio a otro (HU-24), comunes a tabla y calendario. */
export function propiedadesDeArrastre(d: DetalleMenu, a: AccionesMenu) {
  return {
    draggable: a.editable && d.platillo !== null && !a.ocupado,
    onDragStart: (e: React.DragEvent) => e.dataTransfer?.setData('text/plain', d.id),
    onDragOver: (e: React.DragEvent) => {
      if (a.editable) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      if (!a.editable) return;
      e.preventDefault();
      const origen = e.dataTransfer?.getData('text/plain');
      if (origen && origen !== d.id) a.onMover(origen, d.id);
    },
  };
}
