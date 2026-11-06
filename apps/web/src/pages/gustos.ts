/** "1 platillo dejará de sugerirse: Chile relleno" (CA-10.1). */
export function textoImpacto(nombres: string[]): string {
  const n = nombres.length;
  return `${n} ${n === 1 ? 'platillo dejará' : 'platillos dejarán'} de sugerirse: ${nombres.join(', ')}`;
}
