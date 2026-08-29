import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from '../types/comedor';
import { logAuditEvent } from './auditService';

const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 horas
let inactivityTimer: any = null;

export const DEFAULT_DEMO_USERS: Record<string, { email: string; rol: UserRole; displayName: string; gruposAsignados: string[] }> = {
  "admin@sanbuenaventura.es": {
    email: "admin@sanbuenaventura.es",
    displayName: "Dirección / Administrador",
    rol: "admin",
    gruposAsignados: []
  },
  "cocina@sanbuenaventura.es": {
    email: "cocina@sanbuenaventura.es",
    displayName: "Responsable Cocina",
    rol: "kitchen",
    gruposAsignados: []
  },
  "profesor.infantil@sanbuenaventura.es": {
    email: "profesor.infantil@sanbuenaventura.es",
    displayName: "Dña. Carmen López (Infantil)",
    rol: "teacher",
    gruposAsignados: ["Infantil_1º_A", "Infantil_1º_B", "Infantil_2º_A", "Infantil_2º_B", "Infantil_3º_A", "Infantil_3º_B", "Infantil_3º_C"]
  },
  "profesor.primaria@sanbuenaventura.es": {
    email: "profesor.primaria@sanbuenaventura.es",
    displayName: "D. Carlos Gómez (Primaria)",
    rol: "teacher",
    gruposAsignados: ["Primaria_1º_A", "Primaria_1º_B", "Primaria_1º_C", "Primaria_2º_A", "Primaria_2º_B", "Primaria_2º_C", "Primaria_3º_A", "Primaria_3º_B", "Primaria_3º_C", "Primaria_4º_A", "Primaria_4º_B", "Primaria_4º_C", "Primaria_5º_A", "Primaria_5º_B", "Primaria_5º_C", "Primaria_6º_A", "Primaria_6º_B", "Primaria_6º_C"]
  }
};

/**
 * Obtiene o crea el perfil de usuario en Firestore asegurando el rol.
 */
export async function getUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userDocRef = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    return {
      uid: user.uid,
      email: user.email || data.email || '',
      displayName: user.displayName || data.displayName || user.email?.split('@')[0] || 'Usuario',
      rol: data.rol || 'teacher',
      gruposAsignados: data.gruposAsignados || [],
      esProfesorGlobal: data.esProfesorGlobal ?? (data.rol === 'admin' || data.rol === 'kitchen'),
      lastLoginAt: new Date().toISOString()
    };
  }

  // Si no existe, comprobamos si coincide con los perfiles preconfigurados del colegio
  const defaultUser = DEFAULT_DEMO_USERS[user.email?.toLowerCase() || ''];
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || defaultUser?.displayName || user.email?.split('@')[0] || 'Docente',
    rol: defaultUser?.rol || (user.email?.includes('cocina') ? 'kitchen' : user.email?.includes('admin') ? 'admin' : 'teacher'),
    gruposAsignados: defaultUser?.gruposAsignados || (user.email?.includes('admin') || user.email?.includes('cocina') ? [] : [
      "Infantil_1º_A", "Infantil_1º_B", "Infantil_2º_A", "Infantil_2º_B", "Infantil_3º_A", "Infantil_3º_B", "Infantil_3º_C",
      "Primaria_1º_A", "Primaria_1º_B", "Primaria_1º_C", "Primaria_2º_A", "Primaria_2º_B", "Primaria_2º_C",
      "Primaria_3º_A", "Primaria_3º_B", "Primaria_3º_C", "Primaria_4º_A", "Primaria_4º_B", "Primaria_4º_C",
      "Primaria_5º_A", "Primaria_5º_B", "Primaria_5º_C", "Primaria_6º_A", "Primaria_6º_B", "Primaria_6º_C"
    ]),
    esProfesorGlobal: defaultUser?.rol === 'admin' || defaultUser?.rol === 'kitchen',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  await setDoc(userDocRef, newProfile);
  return newProfile;
}

/**
 * Autenticación mediante Google Workspace Escolar
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const profile = await getUserProfile(cred.user);
  
  await logAuditEvent({
    userId: profile.uid,
    userName: profile.displayName,
    userRole: profile.rol,
    action: 'LOGIN',
    targetType: 'usuario',
    targetId: profile.uid,
    details: { method: 'Google_Workspace', email: profile.email }
  });

  return profile;
}

/**
 * Autenticación mediante Email / Password institucional
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  let userCred;
  try {
    userCred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      // Si es un usuario preconfigurado escolar, lo auto-creamos
      userCred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    } else {
      throw err;
    }
  }

  const profile = await getUserProfile(userCred.user);
  await logAuditEvent({
    userId: profile.uid,
    userName: profile.displayName,
    userRole: profile.rol,
    action: 'LOGIN',
    targetType: 'usuario',
    targetId: profile.uid,
    details: { method: 'Email_Password', email: profile.email }
  });

  return profile;
}

/**
 * Cierre de sesión seguro con auditoría
 */
export async function logoutUser(userProfile?: UserProfile | null): Promise<void> {
  if (userProfile) {
    await logAuditEvent({
      userId: userProfile.uid,
      userName: userProfile.displayName,
      userRole: userProfile.rol,
      action: 'LOGOUT',
      targetType: 'usuario',
      targetId: userProfile.uid,
      details: { timestamp: new Date().toISOString() }
    });
  }
  await signOut(auth);
}

/**
 * Configuración de temporizador de inactividad para cierre de sesión en tablets
 */
export function resetInactivityTimer(onTimeout: () => void) {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    onTimeout();
  }, INACTIVITY_TIMEOUT_MS);
}
