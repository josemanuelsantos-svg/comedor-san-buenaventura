import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  Firestore
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBlgbaGrSIjdaqXI0SVbZgdim5z8uNzBxs",
  authDomain: "comedorcsb.firebaseapp.com",
  projectId: "comedorcsb",
  storageBucket: "comedorcsb.firebasestorage.app",
  messagingSenderId: "310874789678",
  appId: "1:310874789678:web:65442102af5aec75bd0cbf",
  measurementId: "G-CDLDNM330N"
};

// Inicialización de la app
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Autenticación con persistencia local permanente en dispositivo
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("No se pudo fijar la persistencia de autenticación local:", err);
});

// Inicialización de Firestore con caché persistente multi-pestaña moderna
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // En caso de re-inicialización en hot reload
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
