/**
 * Obtiene la fecha actual o dada en formato ISO 'YYYY-MM-DD' usando getters locales nativos.
 * Inmune a desfases horarios (DST / Daylight Saving Time) o llamadas a medianoche.
 */
export function getLocalISODate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formatea una fecha ISO para presentación humana accesible en español.
 */
export function formatHumanDate(isoDate: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('es-ES', options);
}

/**
 * Obtiene el mes en formato 'YYYY-MM'.
 */
export function getLocalISOMonth(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}
