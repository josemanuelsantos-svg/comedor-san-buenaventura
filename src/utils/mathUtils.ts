import { DailyRecord, StudentOperational } from '../types/comedor';

/**
 * Calcula el total general de comensales para un aula de forma atómica e inmutable.
 */
export function calculateClassTotal(
  fijos: number | string,
  tickets: number | string,
  profesorSeQueda: boolean,
  extraCount: number = 0
): number {
  const f = Math.max(0, parseInt(String(fijos), 10) || 0);
  const t = Math.max(0, parseInt(String(tickets), 10) || 0);
  const p = profesorSeQueda ? 1 : 0;
  const e = Math.max(0, parseInt(String(extraCount), 10) || 0);
  return f + t + p + e;
}

/**
 * Calcula el desglose exacto de Menús Estándar vs Menús Especiales.
 * Regla: Los especiales son una clasificación del total, nunca duplican platos.
 */
export function calculateMenuBreakdown(
  totalPlatos: number,
  especialesPresentesCount: number
): { estandar: number; especial: number } {
  const especial = Math.min(totalPlatos, Math.max(0, especialesPresentesCount));
  const estandar = Math.max(0, totalPlatos - especial);
  return { estandar, especial };
}

/**
 * Calcula el desglose exacto de Picnics Estándar vs Picnics Especiales.
 */
export function calculatePicnicBreakdown(
  totalPlatos: number,
  especialesPresentesCount: number
): { picnicEstandar: number; picnicEspecial: number } {
  const picnicEspecial = Math.min(totalPlatos, Math.max(0, especialesPresentesCount));
  const picnicEstandar = Math.max(0, totalPlatos - picnicEspecial);
  return { picnicEstandar, picnicEspecial };
}

/**
 * Valida la integridad aritmética de un registro antes de su persistencia.
 */
export function validateRecordArithmetic(record: Partial<DailyRecord>): { valid: boolean; error?: string } {
  const fijos = Math.max(0, Number(record.fijos) || 0);
  const tickets = Math.max(0, Number(record.tickets) || 0);
  const profesor = record.profesorSeQueda ? 1 : 0;
  const calculatedTotal = fijos + tickets + profesor;

  if (record.totalPlatos !== calculatedTotal) {
    return {
      valid: false,
      error: `Discrepancia en total: esperado ${calculatedTotal}, registrado ${record.totalPlatos}`
    };
  }

  const especialesCount = (record.especialesPresentes || record.especiales || []).length;
  if (especialesCount > calculatedTotal) {
    return {
      valid: false,
      error: `El número de dietas especiales (${especialesCount}) no puede superar el total de comensales (${calculatedTotal})`
    };
  }

  return { valid: true };
}

/**
 * Agregación matemática consolidada para Cocina diferenciando Infantil, Primaria y Secundaria.
 */
export function aggregateKitchenDaily(registros: DailyRecord[]) {
  const stats = {
    total: 0,
    totInf: 0,
    totPri: 0,
    totSec: 0,
    totComedorEstandar: 0,
    totComedorEspecial: 0,
    totPicnicsEstandar: 0,
    totPicnicsEspecial: 0,
    totPicnics: 0,
    totTickets: 0,
    totFijos: 0,
    totalDietas: 0,
    totalAusencias: 0,
    totInfComedorEstandar: 0,
    totInfComedorEspecial: 0,
    totInfPicnicEstandar: 0,
    totInfPicnicEspecial: 0,
    totInfTickets: 0,
    totPriComedorEstandar: 0,
    totPriComedorEspecial: 0,
    totPriPicnicEstandar: 0,
    totPriPicnicEspecial: 0,
    totPriTickets: 0,
    totSecComedorEstandar: 0,
    totSecComedorEspecial: 0,
    totSecPicnicEstandar: 0,
    totSecPicnicEspecial: 0,
    totSecTickets: 0,
    infantil: [] as DailyRecord[],
    primaria: [] as DailyRecord[],
    secundaria: [] as DailyRecord[]
  };

  registros.forEach(r => {
    const fijos = Number(r.fijos) || 0;
    const tickets = Number(r.tickets) || 0;
    const totalAula = (Number(r.totalPlatos) || (fijos + tickets + (r.profesorSeQueda ? 1 : 0)));
    const especialesPresentes = (r.especialesPresentes || r.especiales || []).length;
    const isExcursion = r.modalidad === 'picnic' || !!r.esExcursion;

    stats.total += totalAula;
    stats.totFijos += fijos;
    stats.totTickets += tickets;
    stats.totalDietas += especialesPresentes;
    stats.totalAusencias += (r.especialesAusentes || []).length;

    if (isExcursion) {
      const { picnicEstandar, picnicEspecial } = calculatePicnicBreakdown(totalAula, especialesPresentes);
      stats.totPicnicsEstandar += picnicEstandar;
      stats.totPicnicsEspecial += picnicEspecial;
      stats.totPicnics += totalAula;

      if (r.etapa === 'Infantil') {
        stats.totInf += totalAula;
        stats.totInfPicnicEstandar += picnicEstandar;
        stats.totInfPicnicEspecial += picnicEspecial;
        stats.totInfTickets += tickets;
        stats.infantil.push(r);
      } else if (r.etapa === 'Secundaria') {
        stats.totSec += totalAula;
        stats.totSecPicnicEstandar += picnicEstandar;
        stats.totSecPicnicEspecial += picnicEspecial;
        stats.totSecTickets += tickets;
        stats.secundaria.push(r);
      } else {
        stats.totPri += totalAula;
        stats.totPriPicnicEstandar += picnicEstandar;
        stats.totPriPicnicEspecial += picnicEspecial;
        stats.totPriTickets += tickets;
        stats.primaria.push(r);
      }
    } else {
      const { estandar, especial } = calculateMenuBreakdown(totalAula, especialesPresentes);
      stats.totComedorEstandar += estandar;
      stats.totComedorEspecial += especial;

      if (r.etapa === 'Infantil') {
        stats.totInf += totalAula;
        stats.totInfComedorEstandar += estandar;
        stats.totInfComedorEspecial += especial;
        stats.totInfTickets += tickets;
        stats.infantil.push(r);
      } else if (r.etapa === 'Secundaria') {
        stats.totSec += totalAula;
        stats.totSecComedorEstandar += estandar;
        stats.totSecComedorEspecial += especial;
        stats.totSecTickets += tickets;
        stats.secundaria.push(r);
      } else {
        stats.totPri += totalAula;
        stats.totPriComedorEstandar += estandar;
        stats.totPriComedorEspecial += especial;
        stats.totPriTickets += tickets;
        stats.primaria.push(r);
      }
    }
  });

  return stats;
}
