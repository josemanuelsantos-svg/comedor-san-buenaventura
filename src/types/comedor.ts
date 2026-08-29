export type UserRole = 'teacher' | 'kitchen' | 'admin' | 'nutrition_or_medical';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  rol: UserRole;
  gruposAsignados: string[]; // e.g. ["Primaria_3º_A", "Infantil_1º_B"]
  esProfesorGlobal?: boolean;
  pinHash?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface StudentOperational {
  id: string;
  nombre: string;
  etapa: 'Infantil' | 'Primaria' | 'Secundaria';
  curso: string;
  letra: string;
  nota: string; // Operational diet requirements: "Sin Gluten", "Sin Huevo", etc.
  dietaBlanda: boolean;
  tipoHabitual: 'fijo' | 'no_comedor';
  alergias?: string[];
  esManual?: boolean;
  rosterId?: string;
  option?: 'comedor' | 'ticket' | 'picnic' | 'falta';
}

export interface StudentClinical {
  id: string;
  nombre: string;
  telefonoContacto: string;
  pautaMedicacion: string;
  protocoloEmergencia: string;
  esCritico?: boolean;
  informesMedicos?: string;
  updatedAt?: string;
}

export type RecordStatus = 'borrador' | 'enviado' | 'confirmado_cocina' | 'corregido' | 'cancelado';

export interface DailyRecord {
  id: string; // Format: YYYY-MM-DD_Etapa_Curso_Letra
  fecha: string; // ISO date YYYY-MM-DD
  etapa: 'Infantil' | 'Primaria' | 'Secundaria';
  curso: string;
  letra: string;
  autorUid: string;
  autorNombre: string;
  fijos: number;
  tickets: number;
  profesorSeQueda: boolean;
  profesorNombre?: string;
  modalidad: 'comedor' | 'picnic';
  fechaExcursion?: string;
  especiales: StudentOperational[]; // Legacy compatibility & operational list
  especialesPresentes: StudentOperational[];
  especialesAusentes: StudentOperational[];
  dietasBlandas: StudentOperational[];
  observaciones: string;
  totalPlatos: number;
  estado: RecordStatus;
  createdAt: string;
  updatedAt: string;
  confirmadoPorCocinaAt?: string;
  [key: string]: any; // For dynamic extracurricular activity counts
}

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE_RECORD' | 'UPDATE_RECORD' | 'CONFIRM_RECORD' | 'CANCEL_RECORD' | 'ACCESS_MEDICAL' | 'UPDATE_ROSTER' | 'UPDATE_SETTINGS' | 'LOGIN' | 'LOGOUT';
  targetType: 'registro' | 'alumno' | 'configuracion' | 'usuario';
  targetId: string;
  details: Record<string, any>;
  diff?: Record<string, { before: any; after: any }>;
}

export interface SchoolActivity {
  id: string;
  nombre: string;
  etapa: string;
  cursos: string[];
  schedule?: Record<string, number[]>;
  icon: string;
}

export interface AppSettings {
  maxComensales: number;
  letras: string[];
  cursosInfantil: string[];
  cursosPrimaria: string[];
  cursosSecundaria?: string[];
  actividades: SchoolActivity[];
}

export interface DailyTotals {
  fecha: string;
  total: number;
  totInf: number;
  totPri: number;
  totSec?: number;
  totComedorEstandar: number;
  totComedorEspecial: number;
  totPicnicsEstandar: number;
  totPicnicsEspecial: number;
  totTickets: number;
  totalDietas?: number;
  totalAusencias?: number;
}
