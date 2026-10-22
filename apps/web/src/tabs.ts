import {
  calendarOutline,
  cartOutline,
  homeOutline,
  restaurantOutline,
  settingsOutline,
} from 'ionicons/icons';

export interface Pestana {
  ruta: string;
  titulo: string;
  icono: string;
}

/** Pestañas principales de la app (prototipo aprobado). */
export const PESTANAS: readonly Pestana[] = [
  { ruta: '/inicio', titulo: 'Inicio', icono: homeOutline },
  { ruta: '/semana', titulo: 'Semana', icono: calendarOutline },
  { ruta: '/lista', titulo: 'Lista', icono: cartOutline },
  { ruta: '/platillos', titulo: 'Platillos', icono: restaurantOutline },
  { ruta: '/configuracion', titulo: 'Configuración', icono: settingsOutline },
];
