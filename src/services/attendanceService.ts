import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { DailyRecord, RecordStatus, StudentOperational, UserProfile } from '../types/comedor';
import { logAuditEvent } from './auditService';
import { calculateClassTotal, validateRecordArithmetic } from '../utils/mathUtils';
import { getLocalISODate } from '../utils/dateUtils';

/**
 * Guarda o actualiza un registro de asistencia de forma atómica y auditada.
 */
export async function saveDailyAttendance(params: {
  record: Omit<DailyRecord, 'createdAt' | 'updatedAt' | 'totalPlatos'> & { totalPlatos?: number };
  user: UserProfile;
  isCorrection?: boolean;
}): Promise<{ success: boolean; recordId: string; error?: string }> {
  const { record, user, isCorrection } = params;

  // 1. Validar fecha
  const targetDate = record.modalidad === 'picnic' && record.fechaExcursion 
    ? record.fechaExcursion 
    : (record.fecha || getLocalISODate());

  const recordId = `${targetDate}_${record.etapa}_${record.curso}_${record.letra}`;
  const totalPlatos = calculateClassTotal(record.fijos, record.tickets, record.profesorSeQueda);

  const fullRecord: DailyRecord = {
    ...record,
    id: recordId,
    fecha: targetDate,
    totalPlatos,
    autorUid: user.uid,
    autorNombre: user.displayName || user.email,
    estado: isCorrection ? 'corregido' : 'enviado',
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 2. Validación de integridad matemática
  const validation = validateRecordArithmetic(fullRecord);
  if (!validation.valid) {
    return { success: false, recordId, error: validation.error };
  }

  // 3. Persistencia atómica en Firestore
  const docRef = doc(db, 'registros_diarios', recordId);
  const existingSnap = await getDoc(docRef);
  const isExisting = existingSnap.exists();
  const previousData = isExisting ? existingSnap.data() : null;

  await setDoc(docRef, {
    ...fullRecord,
    serverUpdatedAt: serverTimestamp(),
    ...(isExisting ? {} : { serverCreatedAt: serverTimestamp() })
  });

  // 4. Auditoría de la acción
  await logAuditEvent({
    userId: user.uid,
    userName: user.displayName,
    userRole: user.rol,
    action: isExisting ? 'UPDATE_RECORD' : 'CREATE_RECORD',
    targetType: 'registro',
    targetId: recordId,
    details: {
      fecha: targetDate,
      etapa: record.etapa,
      curso: record.curso,
      letra: record.letra,
      totalPlatos,
      modalidad: record.modalidad,
      especialesCount: (record.especialesPresentes || record.especiales || []).length
    },
    ...(isExisting ? { diff: { before: previousData, after: fullRecord } } : {})
  });

  return { success: true, recordId };
}

/**
 * Confirmación por parte del personal de cocina.
 */
export async function confirmRecordByKitchen(recordId: string, kitchenUser: UserProfile): Promise<void> {
  const docRef = doc(db, 'registros_diarios', recordId);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    estado: 'confirmado_cocina' as RecordStatus,
    confirmadoPorCocinaAt: now,
    confirmadoPorCocinaUid: kitchenUser.uid,
    confirmadoPorCocinaNombre: kitchenUser.displayName
  });

  await logAuditEvent({
    userId: kitchenUser.uid,
    userName: kitchenUser.displayName,
    userRole: kitchenUser.rol,
    action: 'CONFIRM_RECORD',
    targetType: 'registro',
    targetId: recordId,
    details: { timestamp: now }
  });
}

/**
 * Escucha en tiempo real los registros de una fecha específica para Cocina.
 */
export function subscribeKitchenDailyRecords(
  fecha: string, 
  onRecords: (records: DailyRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'registros_diarios'),
    where('fecha', '==', fecha)
  );

  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyRecord));
    onRecords(records);
  }, (err) => {
    console.error(`Error al escuchar registros para ${fecha}:`, err);
    if (onError) onError(err);
  });
}

/**
 * Escucha el registro diario de un aula específica en tiempo real.
 */
export function subscribeClassDailyRecord(
  fecha: string,
  etapa: string,
  curso: string,
  letra: string,
  onRecord: (record: DailyRecord | null) => void
): Unsubscribe {
  const docId = `${fecha}_${etapa}_${curso}_${letra}`;
  const docRef = doc(db, 'registros_diarios', docId);

  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onRecord({ id: snap.id, ...snap.data() } as DailyRecord);
    } else {
      onRecord(null);
    }
  }, (err) => {
    console.error(`Error al escuchar registro de clase ${docId}:`, err);
    onRecord(null);
  });
}
