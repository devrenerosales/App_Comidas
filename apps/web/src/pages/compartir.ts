/** Textos y enlaces para compartir una invitación (HU-02 · CU-01.2 paso 5b). */

/** Mensaje para compartir el enlace (WhatsApp u otra app). */
export function textoParaCompartir(hogarNombre: string, enlace: string): string {
  return `Te invito a unirte a ${hogarNombre} en Menú Familiar para planificar juntos el menú de la semana: ${enlace}`;
}

/** Enlace de wa.me con el mensaje ya escrito (alternativa a la Web Share API). */
export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
