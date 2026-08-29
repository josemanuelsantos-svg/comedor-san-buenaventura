import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { StudentOperational, StudentClinical, UserProfile } from '../types/comedor';
import { logAuditEvent } from './auditService';

/**
 * Escucha el listado operativo de alumnos con dietas de un aula.
 * Aplica minimización de datos: Excluye teléfonos y datos clínicos detallados.
 */
export function subscribeClassRoster(
  etapa: string,
  curso: string,
  letra: string,
  onStudents: (students: StudentOperational[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'alumnos_especiales'),
    where('etapa', '==', etapa),
    where('curso', '==', curso),
    where('letra', '==', letra)
  );

  return onSnapshot(q, (snap) => {
    const students: StudentOperational[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: data.nombre,
        etapa: data.etapa,
        curso: data.curso,
        letra: data.letra,
        nota: data.nota || 'Dieta Especial',
        dietaBlanda: !!data.dietaBlanda,
        tipoHabitual: data.tipoHabitual || 'no_comedor',
        alergias: data.alergias || []
      };
    });
    onStudents(students);
  }, (err) => {
    console.error(`Error al escuchar roster de clase ${etapa} ${curso} ${letra}:`, err);
  });
}

/**
 * Escucha el listado completo de alumnos especiales operativos (Para Cocina y Ajustes).
 */
export function subscribeAllOperationalRoster(
  onStudents: (students: StudentOperational[]) => void
): Unsubscribe {
  const q = collection(db, 'alumnos_especiales');
  return onSnapshot(q, (snap) => {
    const students: StudentOperational[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: data.nombre,
        etapa: data.etapa,
        curso: data.curso,
        letra: data.letra,
        nota: data.nota || 'Dieta Especial',
        dietaBlanda: !!data.dietaBlanda,
        tipoHabitual: data.tipoHabitual || 'no_comedor',
        alergias: data.alergias || []
      };
    });
    onStudents(students);
  });
}

/**
 * Guarda o actualiza un alumno en el roster con auditoría.
 */
export async function saveRosterStudent(
  student: Omit<StudentOperational, 'id'> & { id?: string },
  user: UserProfile
): Promise<string> {
  const isNew = !student.id;
  const docRef = isNew ? doc(collection(db, 'alumnos_especiales')) : doc(db, 'alumnos_especiales', student.id!);
  
  const operationalData: StudentOperational = {
    id: docRef.id,
    nombre: student.nombre.trim(),
    etapa: student.etapa,
    curso: student.curso,
    letra: student.letra,
    nota: student.nota.trim(),
    dietaBlanda: !!student.dietaBlanda,
    tipoHabitual: student.tipoHabitual || 'no_comedor',
    alergias: student.alergias || []
  };

  await setDoc(docRef, operationalData);

  await logAuditEvent({
    userId: user.uid,
    userName: user.displayName,
    userRole: user.rol,
    action: 'UPDATE_ROSTER',
    targetType: 'alumno',
    targetId: docRef.id,
    details: {
      action: isNew ? 'CREATE' : 'UPDATE',
      alumno: student.nombre,
      clase: `${student.curso} ${student.letra} (${student.etapa})`,
      dieta: student.nota
    }
  });

  return docRef.id;
}

/**
 * Elimina un alumno del roster permanente con auditoría.
 */
export async function deleteRosterStudent(studentId: string, studentName: string, user: UserProfile): Promise<void> {
  await deleteDoc(doc(db, 'alumnos_especiales', studentId));
  
  await logAuditEvent({
    userId: user.uid,
    userName: user.displayName,
    userRole: user.rol,
    action: 'UPDATE_ROSTER',
    targetType: 'alumno',
    targetId: studentId,
    details: { action: 'DELETE', alumno: studentName }
  });
}
