import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { aplicarTema, leerTema } from './theme/tema';

registerSW({ immediate: true });
// Antes de pintar, para que no parpadee el tema claro si la persona eligió oscuro.
aplicarTema(leerTema());

const contenedor = document.getElementById('root');
if (!contenedor) throw new Error('No se encontró el elemento #root');

createRoot(contenedor).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
