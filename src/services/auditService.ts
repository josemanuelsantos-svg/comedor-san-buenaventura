import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AuditLogEntry, UserRole } from '../types/comedor';

/**
 * Registra una acción en la colección inmutable de auditoría audit_logs.
 */
export async function logAuditEvent(params: {
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditLogEntry['action'];
  targetType: AuditLogEntry['targetType'];
  targetId: string;
  details: Record<string, any>;
  diff?: Record<string, { before: any; after: any }>;
}): Promise<void> {
  try {
    const auditRef = collection(db, 'audit_logs');
    await addDoc(auditRef, {
      ...params,
      timestamp: new Date().toISOString(),
      serverTimestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Error al registrar auditoría:", err);
  }
}
