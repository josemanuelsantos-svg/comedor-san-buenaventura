import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, CheckCircle, ChefHat, School, ArrowLeft,
  Calendar, UtensilsCrossed, Ticket, History,
  Lock, AlertCircle, Salad, Bot, BookOpen, Plus, Minus, Trash2,
  RefreshCw, WifiOff, ShieldCheck, Link2, HelpCircle, X,
  Shapes, Backpack, Info, Edit3, UserX, AlertTriangle, UserCheck, Printer,
  Settings, Download, Moon, Sun, FileSpreadsheet, Eye, ClipboardCheck, ChevronRight,
  Bookmark, ChevronDown, ChevronUp, RotateCcw, Award, Activity, Music, Smile,
  Baby, GraduationCap
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, 
  enableIndexedDbPersistence, limit, orderBy, getDocs
} from "firebase/firestore";


// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBlgbaGrSIjdaqXI0SVbZgdim5z8uNzBxs",
  authDomain: "comedorcsb.firebaseapp.com",
  projectId: "comedorcsb",
  storageBucket: "comedorcsb.firebasestorage.app",
  messagingSenderId: "310874789678",
  appId: "1:310874789678:web:65442102af5aec75bd0cbf",
  measurementId: "G-CDLDNM330N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Habilitar persistencia offline para que funcione en sótanos/comedores sin cobertura
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Persistencia offline no disponible:", err.code);
});

// Configuración por defecto (modificable en el panel de Settings)
const DEFAULT_SETTINGS = {
  maxComensales: 35,
  letras: ["A", "B", "C"],
  cursosInfantil: ["1º", "2º", "3º"],
  cursosPrimaria: ["1º", "2º", "3º", "4º", "5º", "6º"],
  actividades: [
    {
      id: "catequesis",
      nombre: "Catequesis",
      etapa: "Primaria",
      cursos: ["3º", "4º"],
      // Mapeo de días de la semana (1=Lunes, 2=Martes, etc.)
      schedule: { "3º": [1], "4º": [2] },
      icon: "BookOpen"
    },
    {
      id: "robotica",
      nombre: "Robótica",
      etapa: "Primaria",
      cursos: ["1º", "2º", "3º", "4º", "5º", "6º"],
      schedule: {
        "1º": [2, 4],
        "2º": [2, 4],
        "3º": [2, 4],
        "4º": [1, 3],
        "5º": [1, 3],
        "6º": [1, 3]
      },
      icon: "Bot"
    }
  ]
};

const getLocalISODate = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return (new Date(d - offset)).toISOString().slice(0, 10);
};

// Helper para calcular y guardar agregaciones diarias de totales (Mejora 3)
const updateDailyTotals = async (db, date) => {
  try {
    const q = query(
      collection(db, "registros_diarios"),
      where("fecha", "==", date)
    );
    const snap = await getDocs(q);
    
    let totInf = 0;
    let totPri = 0;
    let totTickets = 0;
    let totalDietas = 0;
    let totalAusencias = 0;
    const clasesRegistradas = [];
    
    snap.forEach(doc => {
      const r = doc.data();
      const fijos = Number(r.fijos) || 0;
      const tickets = Number(r.tickets) || 0;
      const t = fijos + tickets;
      
      totTickets += tickets;
      if (r.etapa === "Infantil") {
        totInf += t;
      } else {
        totPri += t;
      }
      
      if (r.especiales) {
        totalDietas += r.especiales.length;
      }
      if (r.ausencias && r.ausencias.trim().length > 0) {
        totalAusencias++;
      }
      
      clasesRegistradas.push(`${r.etapa}_${r.curso}_${r.letra}`);
    });
    
    await setDoc(doc(db, "totales_diarios", date), {
      fecha: date,
      totInf,
      totPri,
      total: totInf + totPri,
      totTickets,
      totalDietas,
      totalAusencias,
      clasesRegistradas,
      lastUpdated: Date.now()
    }, { merge: true });
    
    console.log("Totales diarios actualizados para:", date);
  } catch (err) {
    console.error("Error al actualizar totales diarios:", err);
  }
};

// Componente principal de la App
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("teacher"); // "teacher" | "admin" | "settings"
  const [registros, setRegistros] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate());
  const [authError, setAuthError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Toasts Notificaciones
  const [toasts, setToasts] = useState([]);

  // Estados de Autenticación de Administración (Seguridad por Clave)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem("comedor_admin_auth") === "true";
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authCallback, setAuthCallback] = useState(null);
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authFormError, setAuthFormError] = useState(false);
  
  // Configuración cargada de LocalStorage o por defecto
  const [appSettings, setAppSettings] = useState(() => {
    const saved = localStorage.getItem("comedor_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.actividades) {
          parsed.actividades = DEFAULT_SETTINGS.actividades;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Modo Oscuro
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("comedor_theme");
    return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  const showToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Sincronizar tema
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("comedor_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("comedor_theme", "light");
    }
  }, [darkMode]);

  // Monitorizar conectividad de red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast("Conexión restaurada. Sincronizando datos...", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("Modo sin conexión activado. Los datos se guardarán localmente.", "warning");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Autenticación de Firebase
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
        if (mounted) setAuthError(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (mounted) {
        setUser(u);
        if (u) setAuthError(false);
      }
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  // Inicialización de datos de prueba para el Roster permanente si está vacío (Mejora 1)
  useEffect(() => {
    if (!user) return;
    const checkAndSeedRoster = async () => {
      try {
        const q = query(collection(db, "alumnos_especiales"), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          console.log("Seeding alumnos_especiales con datos de prueba...");
          const mockStudents = [
            { nombre: "Lucas García", etapa: "Primaria", curso: "3º", letra: "B", nota: "Gluten", dietaBlanda: false },
            { nombre: "María Pérez", etapa: "Primaria", curso: "3º", letra: "B", nota: "Lactosa", dietaBlanda: true },
            { nombre: "Carlos Ruiz", etapa: "Infantil", curso: "2º", letra: "A", nota: "Huevo", dietaBlanda: false },
            { nombre: "Sofía Gómez", etapa: "Primaria", curso: "4º", letra: "C", nota: "Frutos Secos", dietaBlanda: false }
          ];
          for (const student of mockStudents) {
            const docRef = doc(collection(db, "alumnos_especiales"));
            await setDoc(docRef, student);
          }
          showToast("Base de datos de alergias inicializada con alumnos de prueba.", "success");
        }
      } catch (err) {
        console.warn("Error seeding Roster database:", err);
      }
    };
    checkAndSeedRoster();
  }, [user]);

  // Escuchar Firestore en tiempo real para la fecha seleccionada
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    const targetDate = view === "teacher" ? getLocalISODate() : selectedDate; 
    
    const q = query(
      collection(db, "registros_diarios"), 
      where("fecha", "==", targetDate)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistros(data);
      setLoadingData(false);
    }, (err) => {
      console.error("Data Error:", err);
      setLoadingData(false);
      showToast("Error al sincronizar con el servidor.", "error");
    });
    return () => unsubscribe();
  }, [user, selectedDate, view]);

  // Pasarela de Clave de Administración
  const promptAdminAuth = (callback) => {
    if (isAdminAuthenticated) {
      callback();
    } else {
      setAuthCallback(() => callback);
      setAuthPasswordInput("");
      setAuthFormError(false);
      setAuthModalOpen(true);
    }
  };

  const handleAuthSubmit = (e) => {
    if (e) e.preventDefault();
    const correctPassword = localStorage.getItem("comedor_admin_password") || "comedorcsb";
    
    if (authPasswordInput.trim() === correctPassword) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem("comedor_admin_auth", "true");
      setAuthModalOpen(false);
      showToast("Clave correcta. Acceso concedido.", "success");
      if (authCallback) {
        authCallback();
      }
    } else {
      setAuthFormError(true);
      showToast("Contraseña incorrecta.", "error");
    }
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem("comedor_admin_auth");
    setView("teacher");
    showToast("Sesión de administración cerrada con éxito.", "info");
  };

  const saveSettings = (newSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem("comedor_settings", JSON.stringify(newSettings));
    showToast("Configuración guardada correctamente.", "success");
  };

  if (!user && authError) return (
    <div className="p-10 text-center text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/20 h-screen flex flex-col items-center justify-center gap-4">
      <WifiOff className="w-16 h-16 text-red-500 animate-pulse" />
      <h2 className="text-xl font-bold">Error de conexión con la Base de Datos</h2>
      <p className="max-w-md text-sm text-slate-500">No hemos podido autenticar de manera anónima. Verifica tu red o la clave de Firebase.</p>
      <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all shadow-md active:scale-95">Reintentar Conexión</button>
    </div>
  );
  
  if (!user) return (
    <div className="p-10 text-center text-slate-500 h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-900">
      <div className="relative flex items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-950 shadow-lg border border-slate-100 dark:border-slate-800 transition-all hover:scale-105">
        <img src="https://i.ibb.co/YvMv3Qx/Logo-sin-fondo.png" alt="Logo Comedor SB" className="w-20 h-20 animate-bounce" />
        <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-500 rounded-full animate-ping"></div>
      </div>
      <p className="font-semibold text-lg text-slate-700 dark:text-slate-300 animate-pulse">Iniciando Comedor SB...</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 relative print:pb-0 print:bg-white">
      {/* Cabecera superior (Oculta al imprimir) */}
      <header className="bg-white/60 dark:bg-slate-950/60 border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-20 shadow-sm backdrop-blur-lg print:hidden">
        <div className="bg-slate-900 dark:bg-slate-950 text-slate-300 text-[10px] py-1 px-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-1.5">
             <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-orange-500 animate-pulse"}`}></span>
             <span className="font-semibold tracking-wide uppercase">
               Red: {isOnline ? <span className="font-bold text-green-400 font-mono">CONECTADO</span> : <span className="font-bold text-orange-400 font-mono">SIN CONEXIÓN (PERSISTENCIA)</span>}
             </span>
          </div>
          <div className="flex gap-4 items-center font-bold">
            {/* Cerrar Sesión Admin (Garantía de Bloqueo) */}
            {isAdminAuthenticated && (
              <button 
                onClick={handleLogout} 
                className="text-[9.5px] font-extrabold text-red-400 hover:text-red-300 transition-colors uppercase flex items-center gap-1"
                title="Volver a bloquear accesos"
              >
                <Lock className="w-3 h-3" /> Cerrar Sesión Admin
              </button>
            )}
            <button onClick={() => setShowHelp(true)} className="text-slate-300 hover:text-white transition-colors flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Ayuda
            </button>
          </div>
        </div>
        
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Logotipo Oficial */}
            <div className="p-1.5 rounded-2xl bg-white dark:bg-slate-950 shadow-md border border-slate-200 dark:border-slate-800 transition-all hover:rotate-3">
              <img src="https://i.ibb.co/YvMv3Qx/Logo-sin-fondo.png" alt="Logo Comedor SB" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
            </div>
            <div>
              <h1 className="font-black text-base leading-none text-slate-800 dark:text-slate-100">Comedor SB</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${loadingData ? "bg-amber-400 animate-pulse" : "bg-green-500"}`}></span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
                  {loadingData ? "Sincronizando..." : "Sincronizado con cocina"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle Tema */}
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 text-slate-500 dark:text-slate-405 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl transition-all"
              title="Cambiar tema"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
            </button>

            {/* Selector de Vistas Protegido por Contraseña */}
            <div className="flex border border-slate-200/60 dark:border-slate-800/60 p-0.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/60 shadow-inner">
              <button 
                onClick={() => { setView("teacher"); }} 
                className={`btn-hover-effect flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${view === "teacher" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Profesor</span>
              </button>
              <button 
                onClick={() => { 
                  promptAdminAuth(() => {
                    setSelectedDate(getLocalISODate());
                    setView("admin");
                  });
                }} 
                className={`btn-hover-effect flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${view === "admin" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Cocina</span>
              </button>
              <button 
                onClick={() => { 
                  promptAdminAuth(() => {
                    setView("settings");
                  });
                }} 
                className={`btn-hover-effect p-1.5 rounded-lg transition-all ${view === "settings" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
                title="Ajustes de la App"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modal de Validación de Contraseña de Administración */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl max-w-xs w-full shadow-2xl relative border border-slate-100 dark:border-slate-700 animate-scale-80">
            <button 
              onClick={() => setAuthModalOpen(false)} 
              className="absolute top-3 right-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4"/>
            </button>
            
            <form onSubmit={handleAuthSubmit} className="flex flex-col items-center text-center space-y-4">
              <div className="bg-blue-100 dark:bg-blue-950/40 p-3.5 rounded-full text-blue-600 dark:text-blue-400 shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-150">Acceso Restringido</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-normal">Se requiere la clave de administración para acceder a esta sección.</p>
              </div>
              
              <div className="w-full space-y-1">
                <input 
                  type="password" 
                  placeholder="Introduce contraseña" 
                  value={authPasswordInput}
                  onChange={e => { setAuthPasswordInput(e.target.value); setAuthFormError(false); }}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-xl outline-none text-center text-xs font-bold tracking-widest text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-950/50 transition-shadow"
                />
                {authFormError && (
                  <span className="text-[9.5px] font-bold text-red-500 block animate-pulse">Clave incorrecta</span>
                )}
              </div>
              
              <div className="flex gap-2 w-full pt-1">
                <button 
                  type="button"
                  onClick={() => setAuthModalOpen(false)} 
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-550 text-[11px] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/10 text-[11px] transition-all"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="max-w-3xl mx-auto p-4 print:p-0 print:max-w-none">
        {view === "teacher" && (
          <TeacherView 
            db={db} 
            user={user} 
            registrosHoy={registros} 
            appSettings={appSettings}
            showToast={showToast}
            promptAdminAuth={promptAdminAuth}
          />
        )}
        {view === "admin" && (
          <AdminView 
            registros={registros} 
            selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate} 
            loading={loadingData}
            appSettings={appSettings}
            showToast={showToast}
            db={db}
          />
        )}
        {view === "settings" && (
          <SettingsView 
            settings={appSettings} 
            onSave={saveSettings} 
            onReset={() => saveSettings(DEFAULT_SETTINGS)} 
            db={db}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

// VISTA PROFESOR: Formulario paso a paso
function TeacherView({ db, user, registrosHoy, appSettings, showToast, promptAdminAuth }) {
  // Configuración clase por defecto (Productividad Profesor 1)
  const defaultClass = useMemo(() => {
    const saved = localStorage.getItem("comedor_default_class");
    return saved ? JSON.parse(saved) : null;
  }, []);

  const [step, setStep] = useState(defaultClass ? 3 : 1);
  const [formData, setFormData] = useState(() => {
    const initialData = { 
      etapa: defaultClass ? defaultClass.etapa : "", 
      curso: defaultClass ? defaultClass.curso : "", 
      letra: defaultClass ? defaultClass.letra : "", 
      fijos: 0, tickets: 0, 
      ausencias: "",
      profesorNombre: "",
      profesorSeQueda: false
    };
    (appSettings.actividades || []).forEach(act => {
      initialData[act.id] = 0;
    });
    return initialData;
  });

  const [recordarClase, setRecordarClase] = useState(!!defaultClass);

  // Roster de Alumnos de esta clase (Mejora 1)
  const [rosterAlumnos, setRosterAlumnos] = useState([]);
  const [attendance, setAttendance] = useState({}); // { [studentId]: { nombre, nota, dietaBlanda, asiste: true } }
  
  const [manualEspeciales, setManualEspeciales] = useState([]); // Dietas introducidas de forma puntual hoy
  const [nuevoEspecial, setNuevoEspecial] = useState({ nombre: "", dietaBlanda: false, nota: "", alergias: [] });
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [manualAusencias, setManualAusencias] = useState("");
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEasterEgg, setActiveEasterEgg] = useState(null);
  const [esExcursion, setEsExcursion] = useState(false);
  const [fechaExcursion, setFechaExcursion] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Historial del aula local (Productividad Profesor 4)
  const [showHistory, setShowHistory] = useState(false);
  const [classHistory, setClassHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Almacenar localmente el nombre del profesor por defecto
  const [savedTeacherName, setSavedTeacherName] = useState(() => {
    return localStorage.getItem("comedor_default_teacher") || "";
  });

  // Clave del LocalStorage para la última sumisión de esta clase (Productividad Profesor 2)
  const lastSubKey = useMemo(() => {
    if (!formData.etapa || !formData.curso || !formData.letra) return null;
    return `last_sub_${formData.etapa}_${formData.curso}_${formData.letra}`;
  }, [formData.etapa, formData.curso, formData.letra]);

  const hasLastSub = useMemo(() => {
    return lastSubKey ? !!localStorage.getItem(lastSubKey) : false;
  }, [lastSubKey]);

  // Cargar estudiantes del Roster permanente para la clase elegida (Mejora 1)
  useEffect(() => {
    if (step !== 3 || !formData.etapa || !formData.curso || !formData.letra) return;
    
    const q = query(
      collection(db, "alumnos_especiales"),
      where("etapa", "==", formData.etapa),
      where("curso", "==", formData.curso),
      where("letra", "==", formData.letra)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRosterAlumnos(students);
      
      // Inicializar el mapa de asistencia
      setAttendance(prev => {
        const newAttendance = { ...prev };
        students.forEach(s => {
          if (newAttendance[s.id] === undefined) {
            let defaultOption = "falta";
            if (s.tipoHabitual === "fijo") {
              defaultOption = esExcursion ? "picnic" : "comedor";
            }
            newAttendance[s.id] = {
              nombre: s.nombre,
              nota: s.nota,
              dietaBlanda: s.dietaBlanda,
              option: defaultOption
            };
          }
        });
        return newAttendance;
      });
    }, (err) => {
      console.error("Error al cargar Roster en TeacherView:", err);
    });
    
    return () => unsubscribe();
  }, [step, formData.etapa, formData.curso, formData.letra, db]);

  // Cargar historial de esta clase sin requerir índices compuestos de Firebase (Productividad Profesor 4)
  useEffect(() => {
    if (!showHistory || step !== 3 || !formData.etapa || !formData.curso || !formData.letra) return;
    
    setHistoryLoading(true);
    const q = query(
      collection(db, "registros_diarios"),
      where("etapa", "==", formData.etapa),
      where("curso", "==", formData.curso),
      where("letra", "==", formData.letra)
    );
    
    getDocs(q).then((snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenamos cronológicamente en el cliente y extraemos los últimos 10
      const sorted = data.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
      setClassHistory(sorted);
      setHistoryLoading(false);
    }).catch(err => {
      console.error("Error al cargar historial del aula:", err);
      setHistoryLoading(false);
      showToast("Error al cargar el historial del aula.", "error");
    });
  }, [showHistory, step, formData.etapa, formData.curso, formData.letra, db]);

  // Al cargar el paso 3 o al marcar profesorSeQueda, autocompletamos con el guardado
  useEffect(() => {
    if (formData.profesorSeQueda && !formData.profesorNombre) {
      setFormData(prev => ({ ...prev, profesorNombre: savedTeacherName }));
    }
  }, [formData.profesorSeQueda, savedTeacherName]);

  // Manejar cambio de checkbox de recordar clase
  useEffect(() => {
    if (step === 3 && formData.etapa && formData.curso && formData.letra) {
      if (recordarClase) {
        localStorage.setItem("comedor_default_class", JSON.stringify({
          etapa: formData.etapa,
          curso: formData.curso,
          letra: formData.letra
        }));
      } else {
        localStorage.removeItem("comedor_default_class");
      }
    }
  }, [recordarClase, step, formData.etapa, formData.curso, formData.letra]);

  // Cursos disponibles según la etapa seleccionada
  const cursosDisponibles = useMemo(() => {
    if (formData.etapa === "Infantil") return appSettings.cursosInfantil;
    if (formData.etapa === "Primaria") return appSettings.cursosPrimaria;
    return [];
  }, [formData.etapa, appSettings]);

  // Opciones de actividades extra dinámicas según reglas de Ajustes
  const activeActivitiesForClass = useMemo(() => {
    const dayOfWeek = new Date().getDay(); // 1 = Lunes, etc.
    if (!formData.etapa || !formData.curso) return [];
    
    return (appSettings.actividades || []).filter(act => {
      if (act.etapa !== formData.etapa) return false;
      if (!act.cursos.includes(formData.curso)) return false;
      
      const days = act.schedule?.[formData.curso] || [];
      return days.includes(dayOfWeek);
    });
  }, [formData.etapa, formData.curso, appSettings.actividades]);

  const resetForm = () => {
    const defaultFormData = { 
      etapa: "", curso: "", letra: "", 
      fijos: 0, tickets: 0, 
      ausencias: "", 
      profesorNombre: "", 
      profesorSeQueda: false 
    };
    (appSettings.actividades || []).forEach(act => {
      defaultFormData[act.id] = 0;
    });
    setFormData(defaultFormData);
    setManualEspeciales([]);
    setRosterAlumnos([]);
    setAttendance({});
    setNuevoEspecial({ nombre: "", dietaBlanda: false, nota: "", alergias: [] });
    setShowSpecialForm(false);
    setManualAusencias("");
    setIsEditing(false);
    setEsExcursion(false);
    setFechaExcursion(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });
    setStep(1);
    setCompleted(false);
    setShowHistory(false);
  };

  const handleClearDefaultClass = () => {
    localStorage.removeItem("comedor_default_class");
    setRecordarClase(false);
    resetForm();
  };

  // Manejador numérico mejorado (sin NaN y límites configurables)
  const handleInputChange = (field, value) => {
    if (value === "") {
      setFormData(prev => ({ ...prev, [field]: "" })); // Permitir que esté vacío temporalmente mientras escribe
      return;
    }
    let num = parseInt(value);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > appSettings.maxComensales) num = appSettings.maxComensales;
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  // Incrementar/decrementar manejador seguro
  const adjustValue = (field, delta) => {
    const currentValue = Number(formData[field]) || 0;
    let newValue = currentValue + delta;
    if (newValue < 0) newValue = 0;
    if (newValue > appSettings.maxComensales) newValue = appSettings.maxComensales;
    setFormData(prev => ({ ...prev, [field]: newValue }));
  };

  // Alumnos de Roster Ausente compilados para visualización (Mejora 1)
  const rosterAbsentes = useMemo(() => {
    return rosterAlumnos
      .filter(s => s.tipoHabitual === "fijo" && attendance[s.id] && attendance[s.id].option === "falta")
      .map(s => `${s.nombre} (${s.nota || "Dieta Especial"})`);
  }, [rosterAlumnos, attendance]);

  // Alumnos Dieta Especial temporales/ocasionales
  const addManualEspecial = () => {
    if (!nuevoEspecial.nombre.trim()) {
      showToast("Debes escribir el nombre del alumno.", "warning");
      return;
    }
    const alergiasList = [...nuevoEspecial.alergias];
    if (nuevoEspecial.nota.trim()) {
      alergiasList.push(nuevoEspecial.nota.trim());
    }

    setManualEspeciales([...manualEspeciales, { 
      id: Date.now(),
      nombre: nuevoEspecial.nombre.trim(), 
      dietaBlanda: nuevoEspecial.dietaBlanda, 
      nota: alergiasList.join(", "),
      esTemporal: true
    }]);
    
    setNuevoEspecial({ nombre: "", dietaBlanda: false, nota: "", alergias: [] });
    setShowSpecialForm(false);
    showToast("Alumno añadido a dietas de hoy.", "success");
  };

  const removeManualEspecial = (id) => {
    setManualEspeciales(manualEspeciales.filter(e => e.id !== id));
    showToast("Alumno eliminado de la lista.", "info");
  };

  const toggleAlergiaTag = (tag) => {
    setNuevoEspecial(prev => {
      const act = prev.alergias.includes(tag) 
        ? prev.alergias.filter(a => a !== tag) 
        : [...prev.alergias, tag];
      return { ...prev, alergias: act };
    });
  };

  const updateStudentAttendanceOption = (studentId, option) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        option: option
      }
    }));
  };

  // Alternar opciones de picnics/comedor de forma automática al cambiar esExcursion
  useEffect(() => {
    setAttendance(prev => {
      const syncAtt = { ...prev };
      Object.keys(syncAtt).forEach(id => {
        const s = rosterAlumnos.find(x => x.id === id);
        if (s && s.tipoHabitual === "fijo") {
          if (esExcursion && syncAtt[id].option === "comedor") {
            syncAtt[id].option = "picnic";
          } else if (!esExcursion && syncAtt[id].option === "picnic") {
            syncAtt[id].option = "comedor";
          }
        }
      });
      return syncAtt;
    });
  }, [esExcursion, rosterAlumnos]);

  // Cargar datos del día anterior desde el almacenamiento local (Productividad Profesor 2)
  const handleLoadLastSubmission = () => {
    if (!lastSubKey) return;
    const dataStr = localStorage.getItem(lastSubKey);
    if (!dataStr) {
      showToast("No se encontraron registros anteriores locales para esta clase.", "warning");
      return;
    }
    try {
      const data = JSON.parse(dataStr);
      setFormData(prev => ({
        ...prev,
        fijos: data.fijos || 0,
        tickets: data.tickets || 0,
        profesorSeQueda: !!data.profesorSeQueda,
        profesorNombre: data.profesorNombre || ""
      }));
      setManualEspeciales(data.manualEspeciales || []);
      setManualAusencias(data.manualAusencias || "");
      
      const savedOptions = data.especialesOptions || {};
      const savedIds = data.especialesRosterIds || [];
      setAttendance(prev => {
        const syncAtt = { ...prev };
        Object.keys(syncAtt).forEach(id => {
          if (savedOptions[id]) {
            syncAtt[id].option = savedOptions[id];
          } else if (savedIds.includes(id)) {
            syncAtt[id].option = esExcursion ? "picnic" : "comedor";
          } else {
            syncAtt[id].option = "falta";
          }
        });
        return syncAtt;
      });

      showToast("Asistencia de ayer cargada con éxito.", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al decodificar la asistencia de ayer.", "error");
    }
  };

  const enableEditMode = () => {
    if (!yaRegistrado) return;
    setIsEditing(true);
    setEsExcursion(!!yaRegistrado.esExcursion);
    setFechaExcursion(yaRegistrado.fecha || getLocalISODate());
    setFormData(prev => {
      const data = {
        ...prev,
        fijos: yaRegistrado.fijos || 0,
        tickets: yaRegistrado.tickets || 0,
        profesorSeQueda: !!yaRegistrado.profesorNombre,
        profesorNombre: yaRegistrado.profesorNombre || ""
      };
      (appSettings.actividades || []).forEach(act => {
        data[act.id] = yaRegistrado[act.id] || 0;
      });
      return data;
    });

    const manualEsps = [];
    (yaRegistrado.especiales || []).forEach(e => {
      if (!e.rosterId) {
        manualEsps.push({
          id: Date.now() + Math.random(),
          nombre: e.nombre,
          dietaBlanda: e.dietaBlanda,
          nota: e.nota,
          option: e.option || (yaRegistrado.esExcursion ? "picnic" : "comedor"),
          esTemporal: true
        });
      }
    });

    setManualEspeciales(manualEsps);
    setAttendance(prev => {
      const syncAtt = { ...prev };
      Object.keys(syncAtt).forEach(id => {
        const found = (yaRegistrado.especiales || []).find(e => e.rosterId === id);
        if (found) {
          syncAtt[id].option = found.option || (yaRegistrado.esExcursion ? "picnic" : "comedor");
        } else {
          syncAtt[id].option = "falta";
        }
      });
      return syncAtt;
    });

    let manualObs = yaRegistrado.ausencias || "";
    if (manualObs.startsWith("Faltan alumnos estables:")) {
      const parts = manualObs.split(" | Obs: ");
      manualObs = parts.length > 1 ? parts[1] : "";
    }
    setManualAusencias(manualObs);
  };

  // Habilitar la edición de registros (sin contraseña para el profesor)
  const handleEditClickProtected = () => {
    enableEditMode();
  };

  const currentTotal = (Number(formData.fijos) || 0) + (Number(formData.tickets) || 0);
  
  // Buscar si esta clase ya fue registrada hoy
  const yaRegistrado = useMemo(() => {
    return registrosHoy.find(r => r.etapa === formData.etapa && r.curso === formData.curso && r.letra === formData.letra);
  }, [registrosHoy, formData.etapa, formData.curso, formData.letra]);

  const handleSubmit = async () => {
    if (yaRegistrado && !isEditing) return;
    
    // Comprobar campos sin añadir
    if (showSpecialForm && nuevoEspecial.nombre.trim().length > 0) {
      showToast("⚠️ Tienes un alumno escrito pero no añadido. Pulsa 'Añadir alumno' antes de enviar.", "warning");
      return;
    }
    
    if (formData.profesorSeQueda && !formData.profesorNombre.trim()) {
      showToast("⚠️ Has marcado que el profesor/a se queda, pero falta introducir su nombre.", "warning");
      return;
    }

    setSending(true);
    const targetDate = esExcursion && fechaExcursion ? fechaExcursion : getLocalISODate();
    const docId = `${targetDate}_${formData.etapa}_${formData.curso}_${formData.letra}`;
    
    // Guardar nombre del profesor para autocompletados futuros
    if (formData.profesorSeQueda && formData.profesorNombre.trim()) {
      localStorage.setItem("comedor_default_teacher", formData.profesorNombre.trim());
      setSavedTeacherName(formData.profesorNombre.trim());
    }

    // 1. Compilar listado final de alumnos especiales que COMERÁN HOY (Mejora 1)
    const rosterPresentes = rosterAlumnos
      .filter(s => attendance[s.id] && attendance[s.id].option !== "falta")
      .map(s => ({
        nombre: s.nombre,
        dietaBlanda: s.dietaBlanda,
        nota: s.nota,
        rosterId: s.id, // Guardamos referencia al ID del Roster permanente
        option: attendance[s.id].option || (esExcursion ? "picnic" : "comedor")
      }));
    
    const manualEspecialesConOption = manualEspeciales.map(e => ({
      ...e,
      option: e.option || (esExcursion ? "picnic" : "comedor")
    }));

    const especialesFinal = [...rosterPresentes, ...manualEspecialesConOption];

    // 2. Compilar texto final de alumnos alérgicos ausentes
    let ausenciasTextoCompleto = "";
    if (rosterAbsentes.length > 0) {
      ausenciasTextoCompleto = "Faltan alumnos estables: " + rosterAbsentes.join(", ");
      if (manualAusencias.trim()) {
        ausenciasTextoCompleto += " | Obs: " + manualAusencias.trim();
      }
    } else {
      ausenciasTextoCompleto = manualAusencias.trim();
    }
    
    try {
      // Registrar datos del aula en Firestore
      const documentData = {
        fecha: targetDate, 
        timestamp: Date.now(), 
        etapa: formData.etapa, 
        curso: formData.curso, 
        letra: formData.letra,
        fijos: Number(formData.fijos) || 0, 
        tickets: Number(formData.tickets) || 0, 
        total: currentTotal,
        ausencias: ausenciasTextoCompleto,
        profesorNombre: formData.profesorSeQueda ? formData.profesorNombre.trim() : "",
        especiales: especialesFinal, 
        registradoPor: user.uid,
        esExcursion: esExcursion || false
      };
      
      (appSettings.actividades || []).forEach(act => {
        documentData[act.id] = Number(formData[act.id]) || 0;
      });

      await setDoc(doc(db, "registros_diarios", docId), documentData);
      
      // 3. Guardar copia local de este envío para el botón "Cargar datos de ayer" (Productividad Profesor 2)
      if (lastSubKey) {
        localStorage.setItem(lastSubKey, JSON.stringify({
          fijos: Number(formData.fijos) || 0,
          tickets: Number(formData.tickets) || 0,
          profesorSeQueda: formData.profesorSeQueda,
          profesorNombre: formData.profesorNombre,
          especialesRosterIds: rosterPresentes.map(s => s.rosterId),
          especialesOptions: rosterPresentes.reduce((acc, s) => {
            acc[s.rosterId] = s.option;
            return acc;
          }, {}),
          manualEspeciales: manualEspeciales,
          manualAusencias: manualAusencias
        }));
      }

      // 4. Recalcular los totales diarios agregados (Mejora 3)
      await updateDailyTotals(db, targetDate);
      
      setSending(false); 
      setCompleted(true);
      
      // Lanzar confeti y comprobar Easter Egg al completar envío con éxito
      let easterEggInfo = null;
      const fijosNum = Number(formData.fijos) || 0;
      const ticketsNum = Number(formData.tickets) || 0;
      if (formData.profesorSeQueda) {
        if (fijosNum === 3 && ticketsNum === 16) {
          easterEggInfo = {
            titulo: "Juan 3:16",
            cita: "«Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.»",
            mensaje: "Enhorabuena, sigue los pasos de tu líder."
          };
        } else if (fijosNum === 12 && ticketsNum === 7) {
          easterEggInfo = {
            titulo: "La Multiplicación",
            cita: "«Tomó los siete panes y los peces, y dando gracias, los partió y dio a sus discípulos, y los discípulos a la multitud. Y comieron todos, y se saciaron; y recogieron siete canastas llenas de pedazos que sobraron.» (Mateo 15:36-37)",
            mensaje: "Enhorabuena, sigue los pasos de tu líder."
          };
        } else if (fijosNum === 7 && ticketsNum === 7) {
          easterEggInfo = {
            titulo: "Mateo 18:22",
            cita: "«Jesús le dijo: No te digo hasta siete, sino aun hasta setenta veces siete.»",
            mensaje: "Enhorabuena, sigue los pasos de tu líder."
          };
        } else if (fijosNum === 23 && ticketsNum === 1) {
          easterEggInfo = {
            titulo: "Salmo 23:1",
            cita: "«El Señor es mi pastor; nada me faltará. En lugares de delicados pastos me hará descansar, junto a aguas de reposo me pastoreará.»",
            mensaje: "Enhorabuena, sigue los pasos de tu líder."
          };
        }
      }

      if (easterEggInfo) {
        setActiveEasterEgg(easterEggInfo);
        if (window.confetti) {
          const duration = 2.5 * 1000;
          const end = Date.now() + duration;
          (function frame() {
            window.confetti({
              particleCount: 5,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#fbbf24', '#f59e0b', '#d97706']
            });
            window.confetti({
              particleCount: 5,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#fbbf24', '#f59e0b', '#d97706']
            });
            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          }());
        }
      } else if (window.confetti) {
        window.confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.75 }
        });
      }
      showToast("¡Asistencia enviada a cocina con éxito!", "success");
    } catch (error) { 
      console.error(error);
      showToast("Error de conexión. Se guardará localmente.", "error"); 
      setSending(false); 
    }
  };

  if (completed) return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-scale-up">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-sm w-full flex flex-col items-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-955/30 rounded-full flex items-center justify-center mb-4 text-green-500 shadow-inner">
          <ClipboardCheck className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-105 mb-2">¡Datos Enviados!</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          El grupo <span className="font-bold text-slate-700 dark:text-slate-205">{formData.curso} {formData.letra} ({formData.etapa})</span> se ha registrado correctamente en cocina.
        </p>
        <button 
          onClick={resetForm} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm"
        >
          Registrar otro grupo
        </button>
      </div>
    </div>
  );

  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-xl animate-scale-up">
      {/* Barra de Progreso Visual */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/50 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                step === s 
                  ? "bg-blue-650 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10 scale-110" 
                  : step > s 
                    ? "bg-emerald-500 text-white shadow-sm" 
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-650"
              }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              <span className={`text-[10px] font-bold tracking-wider uppercase hidden sm:inline ${
                step === s ? "text-blue-650 dark:text-blue-400" : "text-slate-400 dark:text-slate-505"
              }`}>
                {s === 1 ? "Etapa" : s === 2 ? "Curso" : "Asistencia"}
              </span>
            </div>
            {s < 3 && (
              <div className={`flex-1 h-0.5 mx-4 transition-all duration-500 ${
                step > s ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
      
      <div className="p-6">
        {/* Cabecera del paso */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2 text-slate-400 dark:text-slate-505 font-bold text-xs uppercase tracking-wider items-center">
              {step > 1 && !defaultClass && (
                <button 
                  onClick={() => setStep(s => s - 1)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span>PASO {step}/3</span>
            </div>
            
            {step > 1 && (
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {formData.etapa} {formData.curso && `> ${formData.curso}`} {formData.letra && `> ${formData.letra}`}
              </div>
            )}
        </div>

        {/* PASO 1: Selección Etapa */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-right">
            <h2 className="text-xl font-black text-center text-slate-800 dark:text-slate-100 mb-6">¿Qué etapa vas a registrar?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => { setFormData(prev => ({ ...prev, etapa: "Infantil" })); setStep(2); }} 
                className="interactive-card flex items-center gap-4 p-6 bg-slate-50/40 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-pink-500 dark:hover:border-pink-500 hover:bg-pink-50/20 dark:hover:bg-pink-955/10 transition-all group text-left"
              >
                <div className="p-4 rounded-2xl bg-pink-100/60 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform shadow-inner">
                  <Baby className="w-8 h-8" />
                </div>
                <div>
                  <span className="block text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-pink-650 dark:group-hover:text-pink-400 transition-colors">Infantil</span>
                  <span className="text-xs text-slate-450 dark:text-slate-400">De 1º a 3º de Infantil (Menores)</span>
                </div>
              </button>
              
              <button 
                onClick={() => { setFormData(prev => ({ ...prev, etapa: "Primaria" })); setStep(2); }} 
                className="interactive-card flex items-center gap-4 p-6 bg-slate-50/40 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-all group text-left"
              >
                <div className="p-4 rounded-2xl bg-blue-100/60 dark:bg-blue-955/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-inner">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <div>
                  <span className="block text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-650 dark:group-hover:text-blue-400 transition-colors">Primaria</span>
                  <span className="text-xs text-slate-450 dark:text-slate-400">De 1º a 6º de Primaria</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Selección Curso y Letra */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-right">
            <h2 className="text-xl font-black text-center text-slate-800 dark:text-slate-100">Selecciona el Curso y la Letra</h2>
            
            <div className="space-y-4">
              <span className="block text-xs font-extrabold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Cursos</span>
              <div className="grid grid-cols-3 gap-2.5">
                {cursosDisponibles.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setFormData(prev => ({ ...prev, curso: c }))} 
                    className={`btn-hover-effect py-3.5 rounded-2xl font-bold text-sm transition-all border ${
                      formData.curso === c 
                        ? "bg-blue-650 border-blue-650 text-white shadow-lg shadow-blue-500/20" 
                        : "bg-slate-50/60 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {formData.curso && (
              <div className="space-y-4 animate-slide-up">
                <span className="block text-xs font-extrabold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Letra / Grupo</span>
                <div className="grid grid-cols-3 gap-3.5">
                  {appSettings.letras.map(l => (
                    <button 
                      key={l} 
                      onClick={() => { 
                        setFormData(prev => ({ ...prev, letra: l })); 
                        setTimeout(() => setStep(3), 150); 
                      }} 
                      className="btn-hover-effect py-4 bg-slate-50/60 dark:bg-slate-855/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-750 dark:text-slate-250 hover:bg-blue-50 hover:border-blue-500 dark:hover:bg-blue-955/20 dark:hover:border-blue-450 transition-all hover:scale-105 hover:shadow-md shadow-sm"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Datos de Comensales */}
        {step === 3 && (
          <div className="space-y-6 animate-slide-right">
            {/* Cabecera del formulario del aula */}
            <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              {/* Botón de Cambiar Clase (Productividad Profesor 1) */}
              <button 
                onClick={handleClearDefaultClass} 
                className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-all py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700"
                title="Cambiar a otra clase y resetear"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cambiar Clase</span>
              </button>
              
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{formData.etapa} {formData.curso} - {formData.letra}</h2>
              
              {/* Botón de Carga Histórica Rápida "Cargar datos de ayer" (Productividad Profesor 2) */}
              {hasLastSub ? (
                <button 
                  onClick={handleLoadLastSubmission} 
                  className="flex items-center gap-1 text-[11.5px] font-extrabold text-blue-650 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all py-1.5 px-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-xl border border-blue-100/50 dark:border-blue-950"
                  title="Cargar comensales y dietas registradas ayer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Datos de Ayer</span>
                </button>
              ) : (
                <div className="w-20"></div> // Equilibrador visual
              )}
            </div>
            
            {yaRegistrado && !isEditing ? (
               <div className="bg-gradient-to-tr from-blue-50 to-blue-100/50 dark:from-blue-950/10 dark:to-blue-950/20 p-6 rounded-2xl text-center border-blue-200/60 dark:border-blue-900 border animate-scale-up">
                  <CheckCircle className="w-14 h-14 text-blue-500 dark:text-blue-400 mx-auto mb-3"/>
                  <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Grupo ya Registrado</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">Esta clase ya ha enviado los datos de asistencia para el comedor de hoy.</p>
                  
                  <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-sm mb-5 text-left text-xs border border-blue-100 dark:border-blue-900 space-y-2">
                    <div className="flex justify-between border-b dark:border-slate-800 pb-1.5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Alumnos Fijos (Menú):</span> 
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{yaRegistrado.fijos}</strong>
                    </div>
                    <div className="flex justify-between border-b dark:border-slate-800 pb-1.5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Tickets Sueltos:</span> 
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{yaRegistrado.tickets}</strong>
                    </div>
                    {yaRegistrado.profesorNombre && (
                      <div className="flex justify-between border-b dark:border-slate-800 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Profesor/a:</span> 
                        <strong className="text-slate-800 dark:text-slate-200 text-xs">{yaRegistrado.profesorNombre}</strong>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-blue-700 dark:text-blue-400 pt-1">
                      <span>Total Platos:</span> 
                      <span className="text-base">{yaRegistrado.total}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Botón de Edición Protegido por Contraseña (Seguridad por Clave) */}
                    <button 
                      onClick={handleEditClickProtected} 
                      className="w-full bg-white dark:bg-slate-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-750 transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                      <Edit3 className="w-4 h-4" /> Editar Datos Enviados
                    </button>
                    <button 
                      onClick={() => setStep(1)} 
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 mt-2 hover:underline"
                    >
                      Registrar otra clase
                    </button>
                  </div>
               </div>
            ) : (
              <>
                {/* Checkbox de Excursión y Picnic */}
                <div className="bg-gradient-to-r from-purple-50/20 to-blue-50/20 dark:from-purple-955/5 dark:to-blue-955/5 p-5 rounded-2xl border border-purple-200/40 dark:border-purple-900/30 space-y-4">
                  <label className="flex gap-3 items-center text-sm font-bold text-purple-950 dark:text-purple-300 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-purple-650 rounded cursor-pointer" 
                      checked={esExcursion} 
                      onChange={e => setEsExcursion(e.target.checked)}
                    /> 
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-black text-purple-800 dark:text-purple-400">
                        🎒 ¿Esta clase va de Excursión (Solicitar Picnic)?
                      </span>
                      <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Si se activa, se solicitarán bolsas de picnic en lugar de platos calientes en comedor.
                      </span>
                    </div>
                  </label>

                  {esExcursion && (
                    <div className="pl-8 space-y-2.5 animate-slide-up">
                      <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Fecha de la Excursión:
                      </label>
                      <input 
                        type="date" 
                        value={fechaExcursion}
                        min={getLocalISODate()}
                        onChange={e => setFechaExcursion(e.target.value)}
                        className="font-bold text-slate-705 dark:text-slate-250 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 outline-none cursor-pointer text-xs focus:ring-2 focus:ring-purple-150/40 dark:focus:ring-purple-950/40"
                      />
                    </div>
                  )}
                </div>

                {/* Selector Numérico: Fijos */}
                <div className="bg-slate-50/50 dark:bg-slate-800/10 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-4 relative z-10">
                     <span className="font-bold text-blue-900 dark:text-blue-300 flex gap-2 items-center text-sm">
                       <Users className="w-5 h-5 text-blue-650 dark:text-blue-400"/> {esExcursion ? "Picnics Alumnos Fijos" : "Fijos (Menú)"}
                     </span>
                     <div className="flex gap-2 items-center">
                       <button 
                         onClick={() => adjustValue("fijos", -1)} 
                         className="btn-hover-effect w-9 h-9 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-350 hover:bg-slate-50"
                       >
                         <Minus className="w-4 h-4" />
                       </button>
                       <div className="w-14 text-center">
                         <span className="text-2xl font-black text-slate-800 dark:text-slate-105 block">
                           {formData.fijos}
                         </span>
                       </div>
                       <button 
                         onClick={() => adjustValue("fijos", 1)} 
                         className="btn-hover-effect w-9 h-9 bg-blue-600 dark:bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/10"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                   
                   <input 
                     type="range" 
                     min="0" 
                     max={appSettings.maxComensales} 
                     value={Number(formData.fijos) || 0} 
                     onChange={e => handleInputChange("fijos", e.target.value)} 
                     className="w-full cursor-pointer relative z-10"
                   />
                   <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-505 mt-2 font-bold px-1">
                     <span>0</span>
                     <span>{Math.floor(appSettings.maxComensales / 2)}</span>
                     <span>{appSettings.maxComensales}</span>
                   </div>
                </div>
                
                {/* Selector Numérico: Tickets */}
                <div className="bg-amber-50/20 dark:bg-amber-955/5 p-5 rounded-2xl border border-amber-200/35 dark:border-amber-900/20 flex justify-between items-center">
                   <span className="font-bold text-amber-900 dark:text-amber-300 flex gap-2 items-center text-sm">
                     <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-455"/> {esExcursion ? "Picnics Tickets" : "Tickets Sueltos"}
                   </span>
                   <div className="flex gap-2 items-center">
                     <button 
                       onClick={() => adjustValue("tickets", -1)} 
                       className="btn-hover-effect w-9 h-9 bg-white dark:bg-slate-800 rounded-xl border border-slate-205 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-650 dark:text-slate-350"
                     >
                       <Minus className="w-4 h-4" />
                     </button>
                     <div className="w-14 text-center">
                       <span className="text-2xl font-black text-amber-700 dark:text-amber-400 block">
                         {formData.tickets}
                       </span>
                     </div>
                     <button 
                       onClick={() => adjustValue("tickets", 1)} 
                       className="btn-hover-effect w-9 h-9 bg-amber-500 dark:bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10"
                     >
                       <Plus className="w-4 h-4" />
                     </button>
                   </div>
                </div>

                {/* Profesor se queda */}
                <div className="bg-blue-50/20 dark:bg-blue-950/5 p-5 rounded-2xl border border-blue-200/40 dark:border-blue-900/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 dark:text-blue-300 flex gap-2 items-center text-sm">
                      <UserCheck className="w-5 h-5 text-blue-650 dark:text-blue-400" /> ¿El profesor/a come en el comedor?
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={formData.profesorSeQueda} 
                        onChange={(e) => setFormData(prev => ({ ...prev, profesorSeQueda: e.target.checked }))} 
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {formData.profesorSeQueda && (
                    <div className="animate-slide-up">
                      <input 
                        type="text" 
                        placeholder="Nombre completo del profesor/a" 
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-950 text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-inner" 
                        value={formData.profesorNombre} 
                        onChange={(e) => setFormData(prev => ({ ...prev, profesorNombre: e.target.value }))} 
                      />
                    </div>
                  )}
                </div>

                {/* Actividades Extra (Dinámicas) */}
                {activeActivitiesForClass.length > 0 && (
                  <div className="bg-slate-50/50 dark:bg-slate-800/10 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-3">
                    <h3 className="text-xs font-bold text-slate-405 dark:text-slate-500 uppercase tracking-wider">Actividades Extra Hoy</h3>
                    
                    {activeActivitiesForClass.map(act => {
                      const IconComponent = LucideReact[act.icon] || BookOpen;
                      return (
                        <div key={act.id} className="flex justify-between bg-white/60 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 items-center">
                          <span className="flex gap-2 text-sm font-bold text-blue-700 dark:text-blue-400 items-center">
                            <IconComponent className="w-4 h-4 text-blue-505"/> {act.nombre}
                          </span>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => adjustValue(act.id, -1)} 
                              className="btn-hover-effect w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-slate-850 dark:text-slate-200">{formData[act.id] || 0}</span>
                            <button 
                              type="button"
                              onClick={() => adjustValue(act.id, 1)} 
                              className="btn-hover-effect w-7 h-7 rounded-lg bg-blue-650 text-white font-bold flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sección Alergias y Dietas (Roster permanente e interactivo - Mejora 1) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-slate-755 dark:text-slate-300 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Salad className="w-5 h-5 text-emerald-600 dark:text-emerald-505"/> Dietas Especiales y Alergias
                  </h3>
                  
                  {/* Listado Roster Estable de esta clase */}
                  {rosterAlumnos.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Alumnos estables con dietas</span>
                      {rosterAlumnos.map(student => {
                        const att = attendance[student.id] || {};
                        const currentOption = att.option || (att.asiste !== undefined ? (att.asiste ? (esExcursion ? "picnic" : "comedor") : "falta") : (student.tipoHabitual === "fijo" ? (esExcursion ? "picnic" : "comedor") : "falta"));
                        return (
                          <div 
                            key={student.id} 
                            className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-xl border transition-all gap-2.5 ${
                              currentOption !== "falta" 
                                ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50" 
                                : "bg-slate-50/50 dark:bg-slate-855/40 border-slate-200 dark:border-slate-800 opacity-60"
                            }`}
                          >
                            <div>
                              <div className="font-bold text-sm text-slate-800 dark:text-slate-250 flex items-center gap-2 flex-wrap">
                                <span>{student.nombre}</span>
                                {student.dietaBlanda && <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-850 dark:text-emerald-300 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide">Dieta Blanda</span>}
                                {student.tipoHabitual === "no_comedor" && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-405 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide">No Comedor</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{student.nota}</div>
                            </div>
                            
                            {/* Selector de Opción de Asistencia (Comedor, Ticket, Picnic, Falta) */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 w-fit">
                              <button 
                                type="button"
                                onClick={() => updateStudentAttendanceOption(student.id, "comedor")}
                                className={`px-2.5 py-1 text-[10.5px] font-bold rounded transition-all ${
                                  currentOption === "comedor" 
                                    ? "bg-emerald-600 text-white shadow-sm font-black" 
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Comedor
                              </button>
                              <button 
                                type="button"
                                onClick={() => updateStudentAttendanceOption(student.id, "ticket")}
                                className={`px-2.5 py-1 text-[10.5px] font-bold rounded transition-all ${
                                  currentOption === "ticket" 
                                    ? "bg-amber-500 text-white shadow-sm font-black" 
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Ticket
                              </button>
                              <button 
                                type="button"
                                onClick={() => updateStudentAttendanceOption(student.id, "picnic")}
                                className={`px-2.5 py-1 text-[10.5px] font-bold rounded transition-all ${
                                  currentOption === "picnic" 
                                    ? "bg-purple-600 text-white shadow-sm font-black" 
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Picnic
                              </button>
                              <button 
                                type="button"
                                onClick={() => updateStudentAttendanceOption(student.id, "falta")}
                                className={`px-2.5 py-1 text-[10.5px] font-bold rounded transition-all ${
                                  currentOption === "falta" 
                                    ? "bg-red-500 text-white shadow-sm font-black" 
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Falta
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Listado Dietas Temporales de Hoy */}
                  {manualEspeciales.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Dietas ocasionales de hoy</span>
                      {manualEspeciales.map(esp => (
                        <div key={esp.id} className="flex justify-between items-center bg-blue-50/30 dark:bg-blue-955/10 p-3 rounded-xl border border-blue-100/40 dark:border-blue-900/30 animate-scale-up">
                          <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-202">{esp.nombre}</div>
                            <div className="text-[11px] text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1.5 flex-wrap mt-0.5">
                              {esp.dietaBlanda && <span className="bg-blue-100 dark:bg-blue-950 text-blue-850 dark:text-blue-350 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold">Blanda</span>}
                              <span>{esp.nota}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeManualEspecial(esp.id)} 
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Formulario Añadir Alumno Temporal */}
                  {!showSpecialForm ? (
                    <button 
                      onClick={() => setShowSpecialForm(true)} 
                      className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-855 rounded-xl text-xs text-slate-500 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 dark:hover:border-blue-800 transition-all font-bold flex justify-center items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-850/50"
                    >
                      <Plus className="w-4 h-4"/> Añadir Alumno Temporal (Sólo para hoy)
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-850/40 p-4 rounded-xl space-y-3 border border-blue-100 dark:border-blue-950/50 animate-slide-up">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        <Info className="w-3.5 h-3.5"/> Dieta Ocasional (No se guarda en Ajustes)
                      </div>
                      
                      <input 
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-sm text-slate-855 dark:text-slate-100" 
                        placeholder="Nombre completo (Ej: Lucas)" 
                        value={nuevoEspecial.nombre} 
                        onChange={e => setNuevoEspecial(prev => ({ ...prev, nombre: e.target.value }))}
                      />
                      
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Alergias comunes</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Gluten", "Lactosa", "Huevo", "Frutos Secos", "Pescado"].map(tag => {
                            const active = nuevoEspecial.alergias.includes(tag);
                            return (
                              <button 
                                key={tag} 
                                type="button" 
                                onClick={() => toggleAlergiaTag(tag)}
                                className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold border transition-all ${
                                  active 
                                    ? "bg-blue-655 border-blue-650 text-white shadow-sm" 
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:border-slate-350"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <input 
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-sm text-slate-855 dark:text-slate-100" 
                        placeholder="Otra alergia o especificación adicional..." 
                        value={nuevoEspecial.nota} 
                        onChange={e => setNuevoEspecial(prev => ({ ...prev, nota: e.target.value }))}
                      />
                      
                      <label className="flex gap-2 items-center text-xs font-bold text-slate-650 dark:text-slate-400 cursor-pointer bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 w-fit select-none">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-green-600 rounded" 
                          checked={nuevoEspecial.dietaBlanda} 
                          onChange={e => setNuevoEspecial(prev => ({ ...prev, dietaBlanda: e.target.checked }))}
                        /> 
                        <span>Requiere Dieta Blanda (Pechuga, patata hervida, etc.)</span>
                      </label>
                      
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => { setShowSpecialForm(false); setNuevoEspecial({ nombre: "", dietaBlanda: false, nota: "", alergias: [] }); }} 
                          className="flex-1 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-lg font-bold text-slate-555 text-xs transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={addManualEspecial} 
                          className="flex-1 py-2 bg-blue-650 hover:bg-blue-750 text-white rounded-lg font-bold shadow-md shadow-blue-500/10 text-xs transition-all"
                        >
                          Añadir Alumno
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sección Alérgicos Ausentes */}
                <div className="bg-orange-50/20 dark:bg-orange-950/5 p-5 rounded-2xl border border-orange-200/40 dark:border-orange-900/30 space-y-3">
                  <h3 className="font-bold text-orange-850 dark:text-orange-405 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <UserX className="w-4 h-4 text-orange-600" /> Alérgicos Ausentes Hoy
                  </h3>
                  
                  {rosterAbsentes.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/40 rounded-xl p-3 text-xs font-semibold text-orange-800 dark:text-orange-300 flex items-start gap-2 animate-scale-up">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-orange-550 mt-0.5" />
                      <div>
                        <span className="block font-bold">Faltas automáticas del Roster:</span>
                        <ul className="list-disc list-inside mt-1 font-medium space-y-0.5">
                          {rosterAbsentes.map((ra, idx) => <li key={idx}>{ra}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <textarea 
                    className="w-full p-3.5 rounded-xl border border-slate-250 dark:border-slate-800 text-xs focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-955/40 outline-none text-slate-700 dark:text-slate-250 bg-white dark:bg-slate-900 transition-shadow"
                    placeholder="Escribe observaciones o faltas adicionales del día (Ej: Lucas está malo y no ha venido)..."
                    rows={2}
                    value={manualAusencias}
                    onChange={(e) => setManualAusencias(e.target.value)}
                  />
                </div>

                {/* RECORDAR CLASE CHECKBOX (Productividad Profesor 1) */}
                <div className="px-2 py-1 flex items-center gap-2 select-none">
                  <input 
                    type="checkbox" 
                    id="recordarClaseChk" 
                    checked={recordarClase} 
                    onChange={e => setRecordarClase(e.target.checked)} 
                    className="w-4.5 h-4.5 accent-blue-600 rounded border-slate-305 cursor-pointer"
                  />
                  <label htmlFor="recordarClaseChk" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5 text-blue-505" />
                    <span>Recordar esta clase por defecto en este móvil/dispositivo</span>
                  </label>
                </div>

                {/* HISTORIAL RECIENTE DEL AULA (Productividad Profesor 4) */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  <button 
                    type="button" 
                    onClick={() => setShowHistory(!showHistory)} 
                    className="w-full px-5 py-4 flex justify-between items-center text-left font-bold text-slate-750 dark:text-slate-350 text-xs uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-500" />
                      <span>Historial reciente de esta clase ({formData.curso} {formData.letra})</span>
                    </span>
                    {showHistory ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                  </button>
                  
                  {showHistory && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-955/5 text-xs animate-slide-up">
                      {historyLoading ? (
                        <div className="py-8 text-center text-slate-400 animate-pulse">Cargando registros anteriores...</div>
                      ) : classHistory.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 italic">No hay registros previos cargados.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-405 font-bold uppercase tracking-wider text-[10px]">
                                <th className="pb-2">Fecha</th>
                                <th className="pb-2 text-center">Fijos</th>
                                <th className="pb-2 text-center">Tickets</th>
                                <th className="pb-2 text-center">Total</th>
                                <th className="pb-2">Observaciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                              {classHistory.map(hist => (
                                <tr key={hist.id} className="text-slate-705 dark:text-slate-350">
                                  <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                    {new Date(hist.fecha).toLocaleDateString("es-ES", { day: 'numeric', month: 'short' })}
                                  </td>
                                  <td className="py-2.5 text-center">{hist.fijos}</td>
                                  <td className="py-2.5 text-center">{hist.tickets}</td>
                                  <td className="py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{hist.total}</td>
                                  <td className="py-2.5 max-w-[150px] truncate text-[11px] text-slate-500 dark:text-slate-400" title={hist.ausencias}>
                                    {hist.ausencias || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <span className="font-bold text-slate-500 dark:text-slate-400 text-sm">{esExcursion ? "Total picnics solicitados:" : "Platos de asistencia total:"}</span>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-105">{currentTotal}</span>
                  </div>
                  
                  <button 
                    onClick={handleSubmit} 
                    disabled={sending} 
                    className="w-full bg-slate-900 hover:bg-slate-855 dark:bg-blue-650 dark:hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg active:scale-97 transition-all disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm uppercase tracking-wider"
                  >
                    {sending ? <RefreshCw className="animate-spin w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
                    {sending ? "Guardando Registro..." : (isEditing ? "Confirmar Modificaciones" : (esExcursion ? "Solicitar Picnics a Cocina" : "Enviar Asistencia a Cocina"))}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {activeEasterEgg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="glass-panel max-w-md w-full p-8 rounded-3xl border-2 border-amber-400 dark:border-amber-500/80 shadow-[0_0_30px_rgba(251,191,36,0.3)] dark:shadow-[0_0_40px_rgba(251,191,36,0.15)] text-center relative overflow-hidden animate-scale-up">
            {/* Resplandor de fondo */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl"></div>
            
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-955/35 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-amber-200/50 dark:border-amber-900/50">
              <Award className="w-8 h-8 animate-pulse" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-105 mb-2 tracking-tight">
              {activeEasterEgg.titulo}
            </h3>
            
            <p className="text-amber-700 dark:text-amber-400 font-extrabold text-sm uppercase tracking-wider mb-4 animate-pulse">
              {activeEasterEgg.mensaje}
            </p>
            
            <div className="bg-amber-50/50 dark:bg-amber-955/15 border border-amber-100 dark:border-amber-900/50 p-4.5 rounded-2xl mb-6 text-slate-600 dark:text-slate-300 text-xs leading-relaxed italic relative">
              <span className="text-4xl text-amber-305 dark:text-amber-800/40 font-serif absolute -top-2 left-2 select-none">“</span>
              <span className="relative z-10">{activeEasterEgg.cita}</span>
              <span className="text-4xl text-amber-305 dark:text-amber-800/40 font-serif absolute -bottom-6 right-2 select-none">”</span>
            </div>
            
            <button
              type="button"
              onClick={() => setActiveEasterEgg(null)}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-97 transition-all text-xs uppercase tracking-wider"
            >
              Amén / Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// VISTA COCINA (ADMINISTRACIÓN)
function AdminView({ registros, selectedDate, setSelectedDate, loading, appSettings, showToast, db }) {
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "trends" | "monthly"
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [roster, setRoster] = useState([]);

  // Estados para resumen mensual
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [monthlyRegistros, setMonthlyRegistros] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Suscribirse a alumnos_especiales en tiempo real
  useEffect(() => {
    const q = query(collection(db, "alumnos_especiales"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoster(data);
    }, (err) => {
      console.error("Error cargando Roster en AdminView:", err);
    });
    return () => unsubscribe();
  }, [db]);

  const stats = useMemo(() => {
    let totInfComedor = 0, totPriComedor = 0;
    let totInfPicnic = 0, totPriPicnic = 0;
    let totInfTickets = 0, totPriTickets = 0;
    let totTickets = 0;
    const infantil = [];
    const primaria = [];
    let totalDietas = 0;
    let totalAusencias = 0;

    registros.forEach(r => {
      const fijos = Number(r.fijos) || 0;
      const tickets = Number(r.tickets) || 0;
      const t = fijos + tickets;
      
      totTickets += tickets;

      if (r.etapa === "Infantil") {
        totInfTickets += tickets;
        if (r.esExcursion) {
          totInfPicnic += t;
        } else {
          totInfComedor += t;
        }
        infantil.push(r);
      } else {
        totPriTickets += tickets;
        if (r.esExcursion) {
          totPriPicnic += t;
        } else {
          totPriComedor += t;
        }
        primaria.push(r);
      }
      if (r.especiales) totalDietas += r.especiales.length;
      if (r.ausencias && r.ausencias.trim().length > 0) totalAusencias++;
    });

    const sortFn = (a, b) => {
      if (a.curso !== b.curso) return a.curso.localeCompare(b.curso);
      return a.letra.localeCompare(b.letra);
    };

    infantil.sort(sortFn);
    primaria.sort(sortFn);

    const totComedor = totInfComedor + totPriComedor;
    const totPicnics = totInfPicnic + totPriPicnic;

    return { 
      totInfComedor,
      totPriComedor,
      totInfPicnic,
      totPriPicnic,
      totInfTickets,
      totPriTickets,
      totComedor,
      totPicnics,
      totInf: totInfComedor + totInfPicnic,
      totPri: totPriComedor + totPriPicnic,
      total: totComedor + totPicnics, 
      totTickets, 
      infantil, 
      primaria, 
      totalDietas, 
      totalAusencias 
    };
  }, [registros]);

  // Cargar datos de tendencias optimizados desde totales_diarios (Mejora 3)
  useEffect(() => {
    if (activeTab !== "trends") return;
    
    setLoadingHistory(true);
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, "totales_diarios"),
          orderBy("fecha", "desc"),
          limit(7)
        );
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => doc.data());
        
        // Ordenar de más antiguo a más nuevo para representarlo correctamente en la gráfica
        const sortedHistory = docs.sort((a, b) => a.fecha.localeCompare(b.fecha));
          
        setHistoryData(sortedHistory);
        setLoadingHistory(false);
      } catch (err) {
        console.error("Error al cargar historial:", err);
        setLoadingHistory(false);
        showToast("Error al compilar el historial de tendencias.", "error");
      }
    };
    
    fetchHistory();
  }, [activeTab, db]);

  // Cargar datos mensuales dinámicamente
  useEffect(() => {
    if (activeTab !== "monthly") return;
    
    setLoadingMonthly(true);
    const fetchMonthly = async () => {
      try {
        const [yearStr, monthStr] = selectedMonth.split("-");
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const startDate = `${selectedMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        
        const q = query(
          collection(db, "registros_diarios"),
          where("fecha", ">=", startDate),
          where("fecha", "<=", endDate)
        );
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMonthlyRegistros(docs);
        setLoadingMonthly(false);
      } catch (err) {
        console.error("Error al cargar registros mensuales:", err);
        setLoadingMonthly(false);
        showToast("Error al compilar el resumen mensual.", "error");
      }
    };
    
    fetchMonthly();
  }, [activeTab, selectedMonth, db]);

  // Calcular agregaciones de resumen mensual
  const monthlyStats = useMemo(() => {
    const uniqueDates = new Set();
    let totalPlatos = 0;
    let totalTickets = 0;
    let totalFijos = 0;
    
    const classMap = {};
    
    monthlyRegistros.forEach(r => {
      uniqueDates.add(r.fecha);
      const fijos = Number(r.fijos) || 0;
      const tickets = Number(r.tickets) || 0;
      const total = fijos + tickets;
      
      totalPlatos += total;
      totalTickets += tickets;
      totalFijos += fijos;
      
      const classKey = `${r.etapa}_${r.curso}_${r.letra}`;
      if (!classMap[classKey]) {
        classMap[classKey] = {
          etapa: r.etapa,
          curso: r.curso,
          letra: r.letra,
          acumuladoFijos: 0,
          acumuladoTickets: 0,
          totalPlatos: 0,
          diasRegistrados: 0,
        };
      }
      classMap[classKey].acumuladoFijos += fijos;
      classMap[classKey].acumuladoTickets += tickets;
      classMap[classKey].totalPlatos += total;
      classMap[classKey].diasRegistrados += 1;
    });
    
    const classes = Object.values(classMap);
    
    classes.sort((a, b) => {
      if (a.etapa !== b.etapa) {
        return a.etapa.localeCompare(b.etapa);
      }
      if (a.curso !== b.curso) {
        return a.curso.localeCompare(b.curso);
      }
      return a.letra.localeCompare(b.letra);
    });
    
    const diasComedor = uniqueDates.size;
    const promedioDiario = diasComedor > 0 ? (totalPlatos / diasComedor) : 0;
    
    return {
      diasComedor,
      totalPlatos,
      totalTickets,
      totalFijos,
      promedioDiario,
      classes
    };
  }, [monthlyRegistros]);

  const handlePrint = () => {
    window.print();
  };

  // Exportar datos de asistencia a formato CSV
  const handleExportCSV = () => {
    if (registros.length === 0) {
      showToast("No hay registros disponibles para exportar hoy.", "warning");
      return;
    }

    const activities = appSettings.actividades || [];

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    const actHeaders = activities.map(act => act.nombre).join(",");
    csvContent += "Fecha,Etapa,Curso,Letra,Fijos,Tickets,Total,Profesor" + (actHeaders ? "," + actHeaders : "") + ",Ausencias Alergicos,Dietas Especiales\n";

    registros.forEach(r => {
      const especialesStr = r.especiales?.map(e => `${e.nombre} [${e.option || (r.esExcursion ? 'Picnic' : 'Comedor')}] (${e.dietaBlanda ? 'Blanda. ' : ''}${e.nota})`).join(" | ") || "";
      const row = [
        r.fecha,
        r.etapa,
        r.curso,
        r.letra,
        r.fijos,
        r.tickets,
        r.total,
        r.profesorNombre || ""
      ];
      activities.forEach(act => {
        row.push(r[act.id] || 0);
      });
      row.push(`"${(r.ausencias || "").replace(/"/g, '""')}"`);
      row.push(`"${especialesStr.replace(/"/g, '""')}"`);
      
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `comedor_resumen_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Archivo CSV descargado correctamente.", "success");
  };

  // Exportar reporte mensual agrupado día por día
  const handleExportMonthlyCSV = () => {
    if (monthlyRegistros.length === 0) {
      showToast("No hay registros mensuales disponibles para exportar.", "warning");
      return;
    }

    const activities = appSettings.actividades || [];

    const dailyGroup = {};
    monthlyRegistros.forEach(r => {
      if (!dailyGroup[r.fecha]) {
        dailyGroup[r.fecha] = {
          fecha: r.fecha,
          fijosInfantil: 0,
          ticketsInfantil: 0,
          totalInfantil: 0,
          fijosPrimaria: 0,
          ticketsPrimaria: 0,
          totalPrimaria: 0,
          ticketsTotal: 0,
          platosTotal: 0
        };
        activities.forEach(act => {
          dailyGroup[r.fecha][act.id] = 0;
        });
      }
      const f = Number(r.fijos) || 0;
      const t = Number(r.tickets) || 0;
      const tot = f + t;

      if (r.etapa === "Infantil") {
        dailyGroup[r.fecha].fijosInfantil += f;
        dailyGroup[r.fecha].ticketsInfantil += t;
        dailyGroup[r.fecha].totalInfantil += tot;
      } else {
        dailyGroup[r.fecha].fijosPrimaria += f;
        dailyGroup[r.fecha].ticketsPrimaria += t;
        dailyGroup[r.fecha].totalPrimaria += tot;
      }
      dailyGroup[r.fecha].ticketsTotal += t;
      dailyGroup[r.fecha].platosTotal += tot;
      
      activities.forEach(act => {
        dailyGroup[r.fecha][act.id] += Number(r[act.id]) || 0;
      });
    });

    const sortedDays = Object.values(dailyGroup).sort((a, b) => a.fecha.localeCompare(b.fecha));

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    const actHeaders = activities.map(act => act.nombre).join(",");
    csvContent += "Fecha,Fijos Infantil,Tickets Infantil,Total Infantil,Fijos Primaria,Tickets Primaria,Total Primaria,Total Tickets,Total Platos" + (actHeaders ? "," + actHeaders : "") + "\n";

    sortedDays.forEach(d => {
      const row = [
        d.fecha,
        d.fijosInfantil,
        d.ticketsInfantil,
        d.totalInfantil,
        d.fijosPrimaria,
        d.ticketsPrimaria,
        d.totalPrimaria,
        d.ticketsTotal,
        d.platosTotal
      ];
      activities.forEach(act => {
        row.push(d[act.id]);
      });
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `comedor_resumen_mensual_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte mensual en CSV descargado correctamente.", "success");
  };

  const renderRow = (r) => (
    <div key={r.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors break-inside-avoid">
       <div className="flex justify-between font-bold text-slate-800 dark:text-slate-105 mb-2">
         <span className="text-sm">{r.curso} {r.letra}</span>
         <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{(r.fijos||0)+(r.tickets||0)}</span>
       </div>
       
       <div className="text-[10.5px] text-slate-500 font-semibold flex flex-wrap gap-1.5 print:text-black">
          {r.esExcursion ? (
            <span className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md border border-purple-150/40 dark:border-purple-900/40 print:bg-transparent print:text-black print:border-slate-300 flex items-center gap-1 font-bold">
              🎒 Excursión: {(r.fijos||0)+(r.tickets||0)} Picnics ({r.fijos||0} F, {r.tickets||0} T)
            </span>
          ) : (
            <>
              <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-150/40 dark:border-blue-900/40 print:bg-transparent print:text-black print:border-slate-300">{r.fijos||0} Fijos</span>
              <span className="bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-150/40 dark:border-amber-900/40 print:bg-transparent print:text-black print:border-slate-300">{r.tickets||0} Tickets</span>
            </>
          )}
           {(appSettings.actividades || []).map(act => {
             const val = Number(r[act.id]) || 0;
             if (val <= 0) return null;
             const IconComponent = LucideReact[act.icon] || BookOpen;
             return (
               <span key={act.id} className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-150/40 dark:border-emerald-900/40 flex gap-1 items-center print:bg-transparent print:text-black">
                 <IconComponent className="w-3.5 h-3.5"/> {val} {act.nombre}
               </span>
             );
           })}
       </div>
       
       {r.profesorNombre && (
          <div className="mt-2.5 text-xs text-blue-800 dark:text-blue-350 font-bold bg-blue-50/50 dark:bg-blue-955/20 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-950 flex gap-2 items-center print:bg-white print:border-black">
             <UserCheck className="w-4 h-4 shrink-0" />
             <span>Profesor/a: {r.profesorNombre}</span>
          </div>
       )}

       {r.ausencias && (
          <div className="mt-2.5 text-xs text-red-705 dark:text-red-350 font-bold bg-red-50/50 dark:bg-red-955/20 p-2.5 rounded-xl border border-red-100/50 dark:border-red-950 flex gap-2 items-start print:bg-white print:border-black print:text-black">
             <UserX className="w-4 h-4 shrink-0 text-red-555" />
             <span>Ausentes: {r.ausencias}</span>
          </div>
       )}

       {r.especiales?.length > 0 && (
          <div className="mt-2.5 pl-3 border-l-4 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-955/5 rounded-r-xl py-2 text-xs space-y-1.5 print:bg-white print:border-black">
            {r.especiales.map((e,i) => (
              <div key={i} className="text-slate-750 dark:text-slate-300">
                <strong className="text-emerald-800 dark:text-emerald-400">{e.nombre}</strong>: {e.dietaBlanda ? <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-855 dark:text-emerald-300 px-1 py-0.2 rounded font-bold text-[9px] mr-1 uppercase">Blanda</span> : ""}{e.nota}
              </div>
            ))}
          </div>
       )}
    </div>
  );

  const rosterSpecialsList = useMemo(() => {
    const dietasBlandas = [];
    const presentes = [];
    const ausentes = [];
    const observaciones = [];

    // 1. Obtener todas las observaciones/incidencias de los registros diarios
    registros.forEach(r => {
      if (r.ausencias && r.ausencias.trim()) {
        observaciones.push({
          clase: `${r.curso} ${r.letra}`,
          etapa: r.etapa,
          profesor: r.profesorNombre || "Profesor",
          texto: r.ausencias.trim()
        });
      }
    });

    // 2. Procesar alumnos especiales de las clases enviadas
    registros.forEach(r => {
      // Alumnos estables del Roster permanente correspondientes a este aula
      const classRoster = roster.filter(s => s.etapa === r.etapa && s.curso === r.curso && s.letra === r.letra);
      
      // Alumnos especiales registrados en esta clase hoy (pueden ser del roster o manuales)
      const especialesHoy = r.especiales || [];

      // Cruzamos los estudiantes del roster
      classRoster.forEach(s => {
        // ¿Estuvo presente hoy? (si su rosterId coincide con un elemento de especialesHoy)
        const pres = especialesHoy.find(e => e.rosterId === s.id);
        
        if (pres) {
          presentes.push({
            id: s.id,
            nombre: s.nombre,
            nota: pres.nota || s.nota || s.alergias?.join(", ") || "Dieta Especial",
            clase: `${r.curso} ${r.letra}`,
            etapa: r.etapa,
            dietaBlanda: pres.dietaBlanda,
            option: pres.option || (r.esExcursion ? "picnic" : "comedor"),
            esManual: false
          });
        } else if (s.tipoHabitual === "fijo") {
          // El alumno estable suele quedarse pero no asiste hoy
          ausentes.push({
            id: s.id,
            nombre: s.nombre,
            nota: s.nota || s.alergias?.join(", ") || "Dieta Especial",
            clase: `${r.curso} ${r.letra}`,
            etapa: r.etapa,
            dietaBlanda: s.dietaBlanda
          });
        }
      });

      // Añadir los alumnos especiales manuales que comieron hoy (sin rosterId)
      especialesHoy.forEach(e => {
        if (!e.rosterId) {
          presentes.push({
            nombre: e.nombre,
            nota: e.nota || "Dieta especial ocasional",
            clase: `${r.curso} ${r.letra}`,
            etapa: r.etapa,
            dietaBlanda: e.dietaBlanda,
            option: e.option || (r.esExcursion ? "picnic" : "comedor"),
            esManual: true
          });
        }
      });
    });

    // 3. Compilar lista de dietas blandas (tanto estables presentes como ocasionales manuales)
    registros.forEach(r => {
      (r.especiales || []).forEach(e => {
        if (e.dietaBlanda) {
          dietasBlandas.push({
            nombre: e.nombre,
            clase: `${r.curso} ${r.letra}`,
            etapa: r.etapa,
            nota: e.nota || "Dieta Blanda",
            option: e.option || (r.esExcursion ? "picnic" : "comedor"),
            esManual: !e.rosterId
          });
        }
      });
    });

    return {
      dietasBlandas,
      presentes,
      ausentes,
      observaciones
    };
  }, [registros, roster]);

  const { dietasBlandas, presentes, ausentes } = rosterSpecialsList;
  const dietasBlandasInfantil = useMemo(() => dietasBlandas.filter(s => s.etapa === "Infantil"), [dietasBlandas]);
  const dietasBlandasPrimaria = useMemo(() => dietasBlandas.filter(s => s.etapa === "Primaria"), [dietasBlandas]);
  const presentesInfantil = useMemo(() => presentes.filter(s => s.etapa === "Infantil"), [presentes]);
  const presentesPrimaria = useMemo(() => presentes.filter(s => s.etapa === "Primaria"), [presentes]);
  const ausentesInfantil = useMemo(() => ausentes.filter(s => s.etapa === "Infantil"), [ausentes]);
  const ausentesPrimaria = useMemo(() => ausentes.filter(s => s.etapa === "Primaria"), [ausentes]);

  return (
    <div className="space-y-4 animate-fade-in print:space-y-6">
      
      {/* Resumen exclusivo para Impresión en PDF */}
      <div className="print-header">
        {activeTab === "monthly" ? (
          <>
            <h1>RESUMEN MENSUAL DE COMENSALES</h1>
            <p>Mes del informe: {selectedMonth ? new Date(selectedMonth + "-02").toLocaleDateString("es-ES", { year: 'numeric', month: 'long' }) : ""}</p>
            
            <table className="print-table mt-6">
              <thead>
                <tr>
                  <th>DÍAS REGISTRADOS</th>
                  <th>FIJOS ACUMULADOS</th>
                  <th>TICKETS ACUMULADOS</th>
                  <th>TOTAL PLATOS</th>
                  <th>PROMEDIO DIARIO</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontWeight: 'bold' }}>
                  <td>{monthlyStats.diasComedor}</td>
                  <td>{monthlyStats.totalFijos}</td>
                  <td>{monthlyStats.totalTickets}</td>
                  <td>{monthlyStats.totalPlatos} Platos</td>
                  <td>{monthlyStats.promedioDiario.toFixed(2)} / día</td>
                </tr>
              </tbody>
            </table>
            
            <h3 style={{ fontSize: '13pt', fontWeight: 'bold', marginTop: '20px', textAlign: 'left', borderBottom: '1px solid black', paddingBottom: '4px' }}>DESGLOSE ACUMULADO POR GRUPO</h3>
            <table className="print-table mt-3">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Etapa</th>
                  <th>Días Activo</th>
                  <th>Fijos Acum.</th>
                  <th>Tickets Acum.</th>
                  <th>Total Platos</th>
                  <th>Promedio</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.classes.map((c, i) => (
                  <tr key={i}>
                    <td>{c.curso} {c.letra}</td>
                    <td>{c.etapa}</td>
                    <td>{c.diasRegistrados}</td>
                    <td>{c.acumuladoFijos}</td>
                    <td>{c.acumuladoTickets}</td>
                    <td>{c.totalPlatos}</td>
                    <td>{(c.totalPlatos / (c.diasRegistrados || 1)).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h1>RESUMEN DIARIO DE COMENSALES</h1>
            <p>Fecha del informe: {new Date(selectedDate).toLocaleDateString("es-ES", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <table className="print-table mt-6">
              <thead>
                <tr>
                  <th>ETAPA</th>
                  <th>COMEDOR (MENÚ)</th>
                  <th>PICNIC (EXCURSIÓN)</th>
                  <th>TICKETS INCLUIDOS</th>
                  <th>TOTAL ASISTENCIAS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>INFANTIL</td>
                  <td>{stats.totInfComedor}</td>
                  <td>{stats.totInfPicnic}</td>
                  <td>{stats.totInfTickets}</td>
                  <td style={{ fontWeight: 'bold' }}>{stats.totInf}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>PRIMARIA</td>
                  <td>{stats.totPriComedor}</td>
                  <td>{stats.totPriPicnic}</td>
                  <td>{stats.totPriTickets}</td>
                  <td style={{ fontWeight: 'bold' }}>{stats.totPri}</td>
                </tr>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>
                  <td>TOTAL ACUMULADO</td>
                  <td>{stats.totComedor}</td>
                  <td>{stats.totPicnics}</td>
                  <td>{stats.totTickets}</td>
                  <td style={{ fontSize: '14pt', border: '2px solid black' }}>{stats.total} Platos</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Alertas Críticas (Dietas Especiales y Ausentes) - Solo en vista diaria */}
      {activeTab === "daily" && (stats.totalDietas > 0 || stats.totalAusencias > 0) && (
        <div className="bg-gradient-to-r from-orange-100/60 to-amber-100/60 dark:from-orange-955/20 dark:to-amber-955/20 p-4 rounded-2xl border border-orange-200/50 dark:border-orange-900/30 flex justify-between items-center print:border-black print:bg-white animate-scale-up">
           <div className="flex gap-4">
              {stats.totalDietas > 0 && (
                <div className="font-bold text-orange-850 dark:text-orange-300 flex gap-2 items-center text-sm">
                  <Salad className="w-5 h-5 text-orange-600"/> {stats.totalDietas} Dietas Especiales
                </div>
              )}
              {stats.totalAusencias > 0 && (
                <div className="font-bold text-red-850 dark:text-red-300 flex gap-2 items-center text-sm">
                  <AlertTriangle className="w-5 h-5 text-red-655"/> {stats.totalAusencias} Ausencias Especiales
                </div>
              )}
           </div>
        </div>
      )}

      {/* Navegador de fecha e historial */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center print:hidden">
         <div className="flex gap-2 p-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-755 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab("daily")} 
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "daily" ? "bg-white dark:bg-slate-700 text-slate-850 dark:text-slate-100 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
            >
              Control Diario
            </button>
            <button 
              onClick={() => setActiveTab("monthly")} 
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "monthly" ? "bg-white dark:bg-slate-700 text-slate-850 dark:text-slate-100 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
            >
              Resumen Mensual
            </button>
            <button 
              onClick={() => setActiveTab("trends")} 
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "trends" ? "bg-white dark:bg-slate-700 text-slate-850 dark:text-slate-100 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
            >
              Tendencias e Historial
            </button>
         </div>

         <div className="flex gap-2 items-center w-full md:w-auto justify-end">
           {activeTab === "monthly" ? (
             <>
               <Calendar className="text-blue-500 w-4 h-4 shrink-0"/>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mes:</span>
               <input 
                 type="month" 
                 value={selectedMonth} 
                 onChange={e => setSelectedMonth(e.target.value)} 
                 className="font-bold text-slate-705 dark:text-slate-250 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none cursor-pointer text-xs"
               />
             </>
           ) : (
             <>
               <History className="text-blue-500 w-4 h-4 shrink-0"/>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial:</span>
               <input 
                 type="date" 
                 value={selectedDate} 
                 onChange={e => setSelectedDate(e.target.value)} 
                 className="font-bold text-slate-705 dark:text-slate-250 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none cursor-pointer text-xs"
               />
             </>
           )}
         </div>
      </div>

      {activeTab === "monthly" ? (
        <>
          {/* Tarjetas KPI de resumen mensual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-pink-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-pink-505 tracking-wider uppercase">Días Registrados</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {loadingMonthly ? <RefreshCw className="w-5 h-5 animate-spin text-pink-500" /> : monthlyStats.diasComedor}
              </div>
              <Calendar className="absolute -right-4 -bottom-4 w-14 h-14 text-pink-500/10 dark:text-pink-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-blue-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-blue-500 tracking-wider uppercase">Fijos Acumulados</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {loadingMonthly ? <RefreshCw className="w-5 h-5 animate-spin text-blue-550" /> : monthlyStats.totalFijos}
              </div>
              <Users className="absolute -right-4 -bottom-4 w-14 h-14 text-blue-500/10 dark:text-blue-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-amber-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-amber-500 tracking-wider uppercase">Tickets Acumulados</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {loadingMonthly ? <RefreshCw className="w-5 h-5 animate-spin text-amber-500" /> : monthlyStats.totalTickets}
              </div>
              <Ticket className="absolute -right-4 -bottom-4 w-14 h-14 text-amber-500/10 dark:text-amber-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-emerald-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-emerald-600 tracking-wider uppercase">Total Platos</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {loadingMonthly ? <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" /> : monthlyStats.totalPlatos}
              </div>
              <UtensilsCrossed className="absolute -right-4 -bottom-4 w-14 h-14 text-emerald-500/10 dark:text-emerald-400/5 rotate-12" />
            </div>
          </div>
          
          {/* Botonera de Acciones Mensuales */}
          <div className="flex flex-col sm:flex-row gap-2 print:hidden">
            <button 
              onClick={handlePrint} 
              disabled={loadingMonthly || monthlyRegistros.length === 0}
              className="flex-1 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-3 rounded-xl font-bold shadow-md transition-all flex justify-center items-center gap-2 active:scale-98 text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4"/> Imprimir Reporte Mensual
            </button>
            <button 
              onClick={handleExportMonthlyCSV} 
              disabled={loadingMonthly || monthlyRegistros.length === 0}
              className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-855 text-blue-650 dark:text-blue-400 border border-slate-200 dark:border-slate-800 py-3 rounded-xl font-bold shadow-sm transition-all flex justify-center items-center gap-2 active:scale-98 text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4"/> Exportar Excel Mensual (CSV)
            </button>
          </div>

          {/* Tabla de Desglose Mensual por Clase */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden print:hidden">
            <div className="bg-slate-50 dark:bg-slate-850 px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex gap-2 items-center">
                <FileSpreadsheet className="w-4 h-4 text-blue-500"/> Desglose Acumulado por Aula
              </h3>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-805 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                {monthlyStats.classes.length} Aulas
              </span>
            </div>

            {loadingMonthly ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-semibold">Cargando datos acumulados...</span>
              </div>
            ) : monthlyStats.classes.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-505 italic text-xs">
                No hay registros guardados para este mes en la base de datos.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-855/40 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                      <th className="p-4">Clase / Grupo</th>
                      <th className="p-4">Etapa</th>
                      <th className="p-4 text-center">Días Activo</th>
                      <th className="p-4 text-center">Fijos Acum.</th>
                      <th className="p-4 text-center">Tickets Acum.</th>
                      <th className="p-4 text-center">Platos Totales</th>
                      <th className="p-4 text-center">Promedio Diario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {monthlyStats.classes.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-855/10 transition-colors">
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{c.curso} {c.letra}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${c.etapa === "Infantil" ? "bg-pink-50 dark:bg-pink-955/20 text-pink-700 dark:text-pink-400" : "bg-blue-50 dark:bg-blue-955/45 text-blue-700 dark:text-blue-400"}`}>
                            {c.etapa}
                          </span>
                        </td>
                        <td className="p-4 text-center text-slate-500">{c.diasRegistrados} días</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.acumuladoFijos}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.acumuladoTickets}</td>
                        <td className="p-4 text-center font-black text-blue-600 dark:text-blue-400 text-sm">{c.totalPlatos}</td>
                        <td className="p-4 text-center text-slate-700 dark:text-slate-300">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">
                            {(c.totalPlatos / (c.diasRegistrados || 1)).toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal"> / día</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeTab === "daily" ? (
        <>
          {/* Tarjetas KPI de resumen rápido */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-blue-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-blue-550 tracking-wider uppercase">Comedor (Menú)</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-105 mt-1">{stats.totComedor}</div>
              <UtensilsCrossed className="absolute -right-4 -bottom-4 w-14 h-14 text-blue-500/10 dark:text-blue-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-purple-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-purple-605 tracking-wider uppercase">Picnics (Excursión)</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-105 mt-1">{stats.totPicnics}</div>
              <Backpack className="absolute -right-4 -bottom-4 w-14 h-14 text-purple-500/10 dark:text-purple-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-emerald-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-emerald-600 tracking-wider uppercase">Total General</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-105 mt-1">{stats.total}</div>
              <Users className="absolute -right-4 -bottom-4 w-14 h-14 text-emerald-500/10 dark:text-emerald-400/5 rotate-12" />
            </div>
            
            <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-amber-500 relative overflow-hidden interactive-card text-left">
              <div className="text-[10px] font-extrabold text-amber-500 tracking-wider uppercase">Tickets Sueltos</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-105 mt-1">{stats.totTickets}</div>
              <Ticket className="absolute -right-4 -bottom-4 w-14 h-14 text-amber-500/10 dark:text-amber-400/5 rotate-12" />
            </div>
          </div>
          
          {/* Botonera de Acciones (CSV, Impresión) */}
          <div className="flex flex-col sm:flex-row gap-2 print:hidden">
            <button 
              onClick={handlePrint} 
              className="flex-1 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-3 rounded-xl font-bold shadow-md transition-all flex justify-center items-center gap-2 active:scale-98 text-xs uppercase tracking-wide"
            >
              <Printer className="w-4 h-4"/> Imprimir Resumen Cocina
            </button>
            <button 
              onClick={handleExportCSV} 
              className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-blue-650 dark:text-blue-400 border border-slate-200 dark:border-slate-800 py-3 rounded-xl font-bold shadow-sm transition-all flex justify-center items-center gap-2 active:scale-98 text-xs uppercase tracking-wide"
            >
              <Download className="w-4 h-4"/> Exportar a Excel (CSV)
            </button>
          </div>

          {/* Listado de Clases */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-4">
            {/* INFANTIL COL */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden h-fit border border-pink-100/50 dark:border-pink-955/30 print:shadow-none print:border-slate-300 print:rounded-lg print-card">
              <div className="bg-pink-50/60 dark:bg-pink-950/20 px-4 py-3 border-b border-pink-100 dark:border-pink-955/30 flex flex-col gap-2.5 print:bg-slate-100 print:border-slate-300">
                <div className="flex justify-between items-center w-full">
                  <h3 className="font-bold text-pink-700 dark:text-pink-400 text-sm flex gap-2 items-center print:text-black">
                    <Shapes className="w-4 h-4 text-pink-500"/> INFANTIL
                  </h3>
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
                  ) : (
                    <span className="text-[10px] bg-pink-100 dark:bg-pink-950 text-pink-805 dark:text-pink-300 px-2 py-0.5 rounded-full font-bold">{stats.infantil.length} grupos</span>
                  )}
                </div>
                {!loading && (
                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-pink-100/40 dark:border-pink-900/40 font-semibold text-pink-755 dark:text-pink-300 flex items-center gap-1">
                      🍽️ Menú: <strong className="font-bold text-pink-900 dark:text-white">{stats.totInfComedor}</strong>
                    </span>
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-pink-100/40 dark:border-pink-900/40 font-semibold text-purple-755 dark:text-purple-300 flex items-center gap-1">
                      🎒 Picnic: <strong className="font-bold text-purple-900 dark:text-white">{stats.totInfPicnic}</strong>
                    </span>
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-pink-100/40 dark:border-pink-900/40 font-semibold text-amber-755 dark:text-amber-300 flex items-center gap-1">
                      🎫 Tickets: <strong className="font-bold text-amber-900 dark:text-white">{stats.totInfTickets}</strong>
                    </span>
                    <span className="bg-pink-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 print:bg-pink-650 ml-auto">
                      Total: <strong>{stats.totInf}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="divide-y divide-pink-50/50 dark:divide-pink-955/10">
                {stats.infantil.length > 0 ? (
                  stats.infantil.map(renderRow)
                ) : (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-505 text-xs italic">Sin datos de Infantil hoy.</div>
                )}
              </div>
            </div>

            {/* PRIMARIA COL */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden h-fit border border-blue-100/50 dark:border-blue-950/30 print:shadow-none print:border-slate-300 print:rounded-lg print-card">
              <div className="bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3 border-b border-blue-100 dark:border-blue-955/30 flex flex-col gap-2.5 print:bg-slate-100 print:border-slate-300">
                <div className="flex justify-between items-center w-full">
                  <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm flex gap-2 items-center print:text-black">
                    <Backpack className="w-4 h-4 text-blue-550"/> PRIMARIA
                  </h3>
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-805 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">{stats.primaria.length} grupos</span>
                  )}
                </div>
                {!loading && (
                  <div className="flex flex-wrap gap-2 text-[10.5px]">
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-blue-100/40 dark:border-blue-900/40 font-semibold text-blue-755 dark:text-blue-300 flex items-center gap-1">
                      🍽️ Menú: <strong className="font-bold text-blue-900 dark:text-white">{stats.totPriComedor}</strong>
                    </span>
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-blue-100/40 dark:border-blue-900/40 font-semibold text-purple-755 dark:text-purple-300 flex items-center gap-1">
                      🎒 Picnic: <strong className="font-bold text-purple-900 dark:text-white">{stats.totPriPicnic}</strong>
                    </span>
                    <span className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-blue-100/40 dark:border-blue-900/40 font-semibold text-amber-755 dark:text-amber-300 flex items-center gap-1">
                      🎫 Tickets: <strong className="font-bold text-amber-900 dark:text-white">{stats.totPriTickets}</strong>
                    </span>
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 print:bg-blue-650 ml-auto">
                      Total: <strong>{stats.totPri}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="divide-y divide-blue-50/50 dark:divide-blue-955/10">
                {stats.primaria.length > 0 ? (
                  stats.primaria.map(renderRow)
                ) : (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-505 text-xs italic">Sin datos de Primaria hoy.</div>
                )}
              </div>
            </div>
          </div>

          {/* Panel de Incidencias y Dietas Especiales Consolidado */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden mt-6 print:border-slate-300 break-inside-avoid print:mt-4 print-card animate-fade-in">
            <div className="bg-gradient-to-r from-blue-50/60 to-purple-50/60 dark:from-blue-955/20 dark:to-purple-955/20 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex gap-2 items-center print:text-black">
                  <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Control de Dietas Especiales e Incidencias Diarias</span>
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 print:text-slate-600">
                  Consolidado diario para Cocina cruzado con el Roster de alumnos
                </p>
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider print:border print:border-slate-400 print:text-black print:bg-transparent">
                Hoy
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
              
              {/* COL 1: DIETAS BLANDAS */}
              <div className="space-y-4 text-left">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                  <Salad className="w-4 h-4 text-emerald-500" />
                  <span>Dietas Blandas ({rosterSpecialsList.dietasBlandas.length})</span>
                </h4>
                {rosterSpecialsList.dietasBlandas.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-505 italic text-xs">
                    No hay solicitudes de dieta blanda hoy.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {/* INFANTIL */}
                    {dietasBlandasInfantil.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold text-pink-600 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-pink-100/30 dark:border-pink-900/20 pb-1">
                          <Shapes className="w-3.5 h-3.5 text-pink-500" />
                          <span>🍼 Infantil ({dietasBlandasInfantil.length})</span>
                        </div>
                        <div className="space-y-2">
                          {dietasBlandasInfantil.map((dbStudent, idx) => (
                            <div key={`db-inf-${idx}`} className="p-3 bg-emerald-50/40 dark:bg-emerald-955/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-xl flex flex-col gap-0.5 print:bg-white print:border-slate-300">
                              <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                                <span className="text-emerald-800 dark:text-emerald-400">{dbStudent.nombre}</span>
                                <div className="flex gap-1 items-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-extrabold ${
                                    dbStudent.option === 'picnic' ? 'bg-purple-100 dark:bg-purple-955/20 text-purple-700 dark:text-purple-400' :
                                    dbStudent.option === 'ticket' ? 'bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-405' :
                                    'bg-blue-100 dark:bg-blue-955/20 text-blue-755 dark:text-blue-400'
                                  }`}>
                                    {dbStudent.option === 'picnic' ? 'Picnic' : dbStudent.option === 'ticket' ? 'Ticket' : 'Comedor'}
                                  </span>
                                  <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-750 dark:text-emerald-305 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold">
                                    {dbStudent.clase}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10.5px] text-slate-550 dark:text-slate-400 italic font-semibold">
                                {dbStudent.nota}
                              </span>
                              {dbStudent.esManual && (
                                <span className="text-[8.5px] text-slate-455 dark:text-slate-500 font-extrabold uppercase mt-1">
                                  Añadido puntual
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PRIMARIA */}
                    {dietasBlandasPrimaria.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-100/30 dark:border-blue-900/20 pb-1">
                          <Backpack className="w-3.5 h-3.5 text-blue-500" />
                          <span>🎒 Primaria ({dietasBlandasPrimaria.length})</span>
                        </div>
                        <div className="space-y-2">
                          {dietasBlandasPrimaria.map((dbStudent, idx) => (
                            <div key={`db-pri-${idx}`} className="p-3 bg-emerald-50/40 dark:bg-emerald-955/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-xl flex flex-col gap-0.5 print:bg-white print:border-slate-300">
                              <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                                <span className="text-emerald-800 dark:text-emerald-400">{dbStudent.nombre}</span>
                                <div className="flex gap-1 items-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-extrabold ${
                                    dbStudent.option === 'picnic' ? 'bg-purple-100 dark:bg-purple-955/20 text-purple-700 dark:text-purple-400' :
                                    dbStudent.option === 'ticket' ? 'bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-405' :
                                    'bg-blue-100 dark:bg-blue-955/20 text-blue-755 dark:text-blue-400'
                                  }`}>
                                    {dbStudent.option === 'picnic' ? 'Picnic' : dbStudent.option === 'ticket' ? 'Ticket' : 'Comedor'}
                                  </span>
                                  <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-750 dark:text-emerald-305 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold">
                                    {dbStudent.clase}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10.5px] text-slate-550 dark:text-slate-400 italic font-semibold">
                                {dbStudent.nota}
                              </span>
                              {dbStudent.esManual && (
                                <span className="text-[8.5px] text-slate-455 dark:text-slate-500 font-extrabold uppercase mt-1">
                                  Añadido puntual
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* COL 2: ALERGIAS Y DIETAS ESPECIALES */}
              <div className="space-y-4 lg:pl-6 text-left pt-4 lg:pt-0">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Alergias y Especiales</span>
                </h4>
                
                <div className="space-y-4">
                  {/* PRESENTES */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-505 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span>Comen Hoy ({rosterSpecialsList.presentes.length})</span>
                    </div>
                    {rosterSpecialsList.presentes.length === 0 ? (
                      <div className="py-2 text-slate-400 dark:text-slate-505 italic text-xs">
                        Ningún alumno especial presente hoy.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                        {/* PRESENTES INFANTIL */}
                        {presentesInfantil.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-extrabold text-pink-650 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1">
                              <Shapes className="w-3 h-3 text-pink-500" />
                              <span>🍼 Infantil ({presentesInfantil.length})</span>
                            </div>
                            {presentesInfantil.map((pStudent, idx) => (
                              <div key={`pres-inf-${idx}`} className="p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-lg flex flex-col gap-0.5 print:bg-white print:border-slate-300">
                                <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  <span className="flex items-center gap-1">
                                    {pStudent.nombre}
                                    {pStudent.dietaBlanda && (
                                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-805 dark:text-emerald-305 px-1 py-0.1 rounded text-[8px] uppercase font-bold scale-90">Blanda</span>
                                    )}
                                  </span>
                                  <div className="flex gap-1 items-center">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      pStudent.option === 'picnic' ? 'bg-purple-100 dark:bg-purple-955/20 text-purple-700 dark:text-purple-400' :
                                      pStudent.option === 'ticket' ? 'bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-405' :
                                      'bg-blue-100 dark:bg-blue-955/20 text-blue-755 dark:text-blue-400'
                                    }`}>
                                      {pStudent.option === 'picnic' ? 'Picnic' : pStudent.option === 'ticket' ? 'Ticket' : 'Comedor'}
                                    </span>
                                    <span className="bg-blue-50 dark:bg-blue-955/35 text-blue-700 dark:text-blue-400 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                      {pStudent.clase}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-550 dark:text-slate-400 font-bold">
                                  {pStudent.nota}
                                </span>
                                {pStudent.esManual && (
                                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-0.5">
                                    Añadido puntual
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* PRESENTES PRIMARIA */}
                        {presentesPrimaria.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-extrabold text-blue-650 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                              <Backpack className="w-3 h-3 text-blue-500" />
                              <span>🎒 Primaria ({presentesPrimaria.length})</span>
                            </div>
                            {presentesPrimaria.map((pStudent, idx) => (
                              <div key={`pres-pri-${idx}`} className="p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-lg flex flex-col gap-0.5 print:bg-white print:border-slate-300">
                                <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  <span className="flex items-center gap-1">
                                    {pStudent.nombre}
                                    {pStudent.dietaBlanda && (
                                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-805 dark:text-emerald-305 px-1 py-0.1 rounded text-[8px] uppercase font-bold scale-90">Blanda</span>
                                    )}
                                  </span>
                                  <div className="flex gap-1 items-center">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      pStudent.option === 'picnic' ? 'bg-purple-100 dark:bg-purple-955/20 text-purple-700 dark:text-purple-400' :
                                      pStudent.option === 'ticket' ? 'bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-405' :
                                      'bg-blue-100 dark:bg-blue-955/20 text-blue-755 dark:text-blue-400'
                                    }`}>
                                      {pStudent.option === 'picnic' ? 'Picnic' : pStudent.option === 'ticket' ? 'Ticket' : 'Comedor'}
                                    </span>
                                    <span className="bg-blue-50 dark:bg-blue-955/35 text-blue-700 dark:text-blue-400 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                      {pStudent.clase}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-550 dark:text-slate-400 font-bold">
                                  {pStudent.nota}
                                </span>
                                {pStudent.esManual && (
                                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-0.5">
                                    Añadido puntual
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AUSENTES */}
                  <div className="space-y-2 border-t border-dashed border-slate-100 dark:border-slate-800 pt-3">
                    <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-505 uppercase tracking-wider flex items-center gap-1.5 pb-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span>Ausentes - No preparar ({rosterSpecialsList.ausentes.length})</span>
                    </div>
                    {rosterSpecialsList.ausentes.length === 0 ? (
                      <div className="py-2 text-slate-400 dark:text-slate-505 italic text-xs">
                        No hay ausencias de alumnos especiales hoy.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                        {/* AUSENTES INFANTIL */}
                        {ausentesInfantil.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-extrabold text-pink-650 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1">
                              <Shapes className="w-3 h-3 text-pink-500" />
                              <span>🍼 Infantil ({ausentesInfantil.length})</span>
                            </div>
                            {ausentesInfantil.map((aStudent, idx) => (
                              <div key={`aus-inf-${idx}`} className="p-2 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-100/50 dark:border-slate-800/60 rounded-lg flex justify-between items-center opacity-70 print:bg-white print:border-slate-200 print:opacity-100">
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-slate-655 dark:text-slate-400 text-xs line-through print:no-underline">{aStudent.nombre}</span>
                                  <span className="text-[9.5px] text-slate-400 dark:text-slate-505 font-semibold">{aStudent.nota}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="bg-red-50 dark:bg-red-955/20 text-red-650 dark:text-red-400 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase">
                                    Ausente
                                  </span>
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-455 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                    {aStudent.clase}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AUSENTES PRIMARIA */}
                        {ausentesPrimaria.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-extrabold text-blue-650 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                              <Backpack className="w-3 h-3 text-blue-500" />
                              <span>🎒 Primaria ({ausentesPrimaria.length})</span>
                            </div>
                            {ausentesPrimaria.map((aStudent, idx) => (
                              <div key={`aus-pri-${idx}`} className="p-2 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-100/50 dark:border-slate-800/60 rounded-lg flex justify-between items-center opacity-70 print:bg-white print:border-slate-200 print:opacity-100">
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-slate-655 dark:text-slate-400 text-xs line-through print:no-underline">{aStudent.nombre}</span>
                                  <span className="text-[9.5px] text-slate-400 dark:text-slate-505 font-semibold">{aStudent.nota}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="bg-red-50 dark:bg-red-955/20 text-red-650 dark:text-red-400 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase">
                                    Ausente
                                  </span>
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-455 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                    {aStudent.clase}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COL 3: OBSERVACIONES Y COMENTARIOS */}
              <div className="space-y-4 lg:pl-6 text-left pt-4 lg:pt-0">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>Observaciones y Notas</span>
                </h4>
                {rosterSpecialsList.observaciones.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-505 italic text-xs">
                    Sin observaciones o incidencias reportadas hoy.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {rosterSpecialsList.observaciones.map((obs, idx) => (
                      <div key={idx} className="p-3 bg-blue-50/30 dark:bg-blue-955/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl space-y-1.5 print:bg-white print:border-slate-300">
                        <div className="flex justify-between items-center text-[10px] font-extrabold text-blue-800 dark:text-blue-400 uppercase tracking-wider">
                          <span>Aula: {obs.clase} ({obs.etapa})</span>
                          <span className="text-slate-400 dark:text-slate-500">{obs.profesor}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold italic">
                          "{obs.texto}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      ) : (
        /* GRÁFICO HISTORIAL DE TENDENCIAS (SVG Nativo leyendo de totales_diarios) */
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Tendencias de Asistencia Semanal</h3>
              <p className="text-xs text-slate-400 dark:text-slate-505">Evolución de platos totales en los últimos 7 días registrados</p>
            </div>
            {loadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />}
          </div>

          {loadingHistory ? (
            <div className="h-64 flex items-center justify-center text-slate-400 animate-pulse text-sm">Compilando datos históricos...</div>
          ) : historyData.length < 2 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-405 text-center gap-2 p-6">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <p className="text-sm">Se necesitan al menos registros de 2 días diferentes para trazar tendencias.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contenedor del Gráfico SVG */}
              <div className="relative h-64 w-full bg-slate-50/50 dark:bg-slate-955/20 rounded-xl border border-slate-100 dark:border-slate-850 p-2">
                <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible" style={{ fontFamily: 'Outfit' }}>
                  {/* Definición de gradiente de fondo */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Calcular dimensiones y puntos */}
                  {(() => {
                    const chartWidth = 440;
                    const chartHeight = 180;
                    const paddingLeft = 45;
                    const paddingTop = 20;
                    
                    const maxVal = Math.max(...historyData.map(d => d.total)) * 1.15 || 100;
                    const minVal = 0;
                    const valRange = maxVal - minVal;

                    // Ejes horizontales
                    const yLines = [0, 0.25, 0.5, 0.75, 1];
                    
                    // Coordenadas de puntos
                    const points = historyData.map((d, index) => {
                      const x = paddingLeft + (index * (chartWidth / (historyData.length - 1)));
                      const y = paddingTop + chartHeight - ((d.total - minVal) / valRange * chartHeight);
                      return { x, y, val: d.total, date: d.fecha };
                    });

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");
                    
                    // Puntos de área de relleno
                    const fillPoints = `${points[0].x},${paddingTop + chartHeight} ` + 
                                       polylinePoints + 
                                       ` ${points[points.length - 1].x},${paddingTop + chartHeight}`;

                    return (
                      <>
                        {/* Líneas horizontales de red */}
                        {yLines.map((pct, idx) => {
                          const y = paddingTop + chartHeight - (pct * chartHeight);
                          const valLabel = Math.round(minVal + (pct * valRange));
                          return (
                            <g key={idx} className="opacity-40 dark:opacity-20">
                              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-bold">{valLabel}</text>
                            </g>
                          );
                        })}

                        {/* Área sombreada bajo la curva */}
                        <polygon points={fillPoints} fill="url(#chartGrad)" />

                        {/* Línea principal */}
                        <polyline points={polylinePoints} fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Puntos y etiquetas de texto */}
                        {points.map((p, idx) => (
                          <g key={idx} className="group">
                            {/* Círculo interior */}
                            <circle cx={p.x} cy={p.y} r="5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" className="cursor-pointer transition-all hover:r-7" />
                            {/* Valor encima del punto */}
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#4f46e5" className="text-[10px] font-black dark:fill-blue-350">{p.val}</text>
                            {/* Etiqueta de fecha en eje X */}
                            <text x={p.x} y={paddingTop + chartHeight + 18} textAnchor="middle" fill="#64748b" className="text-[9px] font-bold">
                              {p.date.slice(5)}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
              
              {/* Tabla de registros históricos resumidos */}
              <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-4 bg-slate-50 dark:bg-slate-855 p-2.5 font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wide">
                  <span>Fecha</span>
                  <span className="text-center">Infantil</span>
                  <span className="text-center">Primaria</span>
                  <span className="text-center">Total Platos</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-850">
                  {historyData.map((day, idx) => (
                    <div key={idx} className="grid grid-cols-4 p-3 hover:bg-slate-50/50 dark:hover:bg-slate-855/20 font-medium">
                      <span className="text-slate-800 dark:text-slate-205 font-bold">{new Date(day.fecha).toLocaleDateString("es-ES", { day: 'numeric', month: 'short' })}</span>
                      <span className="text-center text-pink-655 dark:text-pink-400">{day.totInf || 0}</span>
                      <span className="text-center text-blue-650 dark:text-blue-400">{day.totPri || 0}</span>
                      <span className="text-center text-slate-900 dark:text-slate-105 font-black">{day.total || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
{/* Firmas de impresión (Cocina/Dirección) */}
      <div className="print-signature-area">
        <div className="signature-box">Firma Responsable Cocina</div>
        <div className="signature-box">Firma Dirección de Centro</div>
      </div>
    </div>
  );
}

function SettingsView({ settings, onSave, onReset, db, showToast }) {
  const [settingsTab, setSettingsTab] = useState("general"); // "general" | "roster" | "activities"
  const [maxComensales, setMaxComensales] = useState(settings.maxComensales);
  const [letrasInput, setLetrasInput] = useState(settings.letras.join(", "));
  const [cursosInfantilInput, setCursosInfantilInput] = useState(settings.cursosInfantil.join(", "));
  const [cursosPrimariaInput, setCursosPrimariaInput] = useState(settings.cursosPrimaria.join(", "));
  
  // Clave de Seguridad (Seguridad por Clave)
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem("comedor_admin_password") || "comedorcsb";
  });

  // Roster permanente de alumnos
  const [roster, setRoster] = useState([]);
  const [nuevoAlumno, setNuevoAlumno] = useState({ nombre: "", etapa: "Primaria", curso: "3º", letra: "A", nota: "", dietaBlanda: false, tipoHabitual: "no_comedor", alergias: [] });

  // Estados para gestión de actividades extra
  const [editingActivity, setEditingActivity] = useState(null);
  const [formActivityNombre, setFormActivityNombre] = useState("");
  const [formActivityEtapa, setFormActivityEtapa] = useState("Primaria");
  const [formActivityIcon, setFormActivityIcon] = useState("BookOpen");
  const [formActivitySchedule, setFormActivitySchedule] = useState({});

  // Escuchar Roster permanente en tiempo real
  useEffect(() => {
    const q = query(collection(db, "alumnos_especiales"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoster(data);
    }, (err) => {
      console.error("Error cargando Roster en SettingsView:", err);
    });
    return () => unsubscribe();
  }, [db]);

  // Cursos dinámicos para el formulario de añadir estudiante
  const cursosFormInput = useMemo(() => {
    if (nuevoAlumno.etapa === "Infantil") return settings.cursosInfantil;
    if (nuevoAlumno.etapa === "Primaria") return settings.cursosPrimaria;
    return [];
  }, [nuevoAlumno.etapa, settings]);

  // Asegurar que el curso por defecto del formulario es coherente
  useEffect(() => {
    if (cursosFormInput.length > 0 && !cursosFormInput.includes(nuevoAlumno.curso)) {
      setNuevoAlumno(prev => ({ ...prev, curso: cursosFormInput[0] }));
    }
  }, [cursosFormInput, nuevoAlumno.curso]);

  const handleSaveGeneral = () => {
    const letras = letrasInput.split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
    const cursosInfantil = cursosInfantilInput.split(",").map(x => x.trim()).filter(Boolean);
    const cursosPrimaria = cursosPrimariaInput.split(",").map(x => x.trim()).filter(Boolean);

    if (letras.length === 0 || cursosInfantil.length === 0 || cursosPrimaria.length === 0) {
      alert("Por favor, asegúrate de que todos los listados tengan al menos un valor.");
      return;
    }

    if (adminPassword.trim().length === 0) {
      alert("La clave de administración no puede quedar vacía.");
      return;
    }
    localStorage.setItem("comedor_admin_password", adminPassword.trim());

    onSave({
      ...settings,
      maxComensales: Number(maxComensales) || 35,
      letras,
      cursosInfantil,
      cursosPrimaria
    });
    showToast("Ajustes generales guardados.", "success");
  };

  const handleAddAlumnoRoster = async () => {
    if (!nuevoAlumno.nombre.trim()) {
      showToast("Debes introducir el nombre del alumno.", "warning");
      return;
    }

    const alergiasFinal = [...nuevoAlumno.alergias];
    if (nuevoAlumno.nota.trim()) {
      alergiasFinal.push(nuevoAlumno.nota.trim());
    }

    try {
      const docRef = doc(collection(db, "alumnos_especiales"));
      await setDoc(docRef, {
        nombre: nuevoAlumno.nombre.trim(),
        etapa: nuevoAlumno.etapa,
        curso: nuevoAlumno.curso,
        letra: nuevoAlumno.letra,
        nota: alergiasFinal.join(", "),
        dietaBlanda: nuevoAlumno.dietaBlanda,
        tipoHabitual: nuevoAlumno.tipoHabitual || "no_comedor"
      });

      setNuevoAlumno({ nombre: "", etapa: "Primaria", curso: "3º", letra: "A", nota: "", dietaBlanda: false, tipoHabitual: "no_comedor", alergias: [] });
      showToast("Alumno añadido al Roster permanentemente.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar alumno en la base de datos.", "error");
    }
  };

  const handleDeleteAlumnoRoster = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar a este alumno del Roster de alérgenos?")) return;
    try {
      await deleteDoc(doc(db, "alumnos_especiales", id));
      showToast("Alumno eliminado del Roster permanente.", "info");
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar alumno.", "error");
    }
  };

  const handleUpdateAlumnoRosterFrecuencia = async (id, nuevaFrecuencia) => {
    try {
      const docRef = doc(db, "alumnos_especiales", id);
      await setDoc(docRef, { tipoHabitual: nuevaFrecuencia }, { merge: true });
      showToast("Frecuencia de comedor actualizada con éxito.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar la frecuencia.", "error");
    }
  };

  const handleBulkUpdateFrecuencia = async (nuevaFrecuencia) => {
    const actionWord = nuevaFrecuencia === "fijo" ? "Suelen quedarse (Fijos)" : "No suelen quedarse (No Comedor)";
    if (!confirm(`¿Seguro que deseas cambiar la frecuencia de TODOS los alumnos especiales a ${actionWord}?`)) return;
    try {
      for (const student of roster) {
        const docRef = doc(db, "alumnos_especiales", student.id);
        await setDoc(docRef, { tipoHabitual: nuevaFrecuencia }, { merge: true });
      }
      showToast("Todos los alumnos alérgicos actualizados en lote.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al realizar la actualización en lote.", "error");
    }
  };

  const toggleAllergyFormTag = (tag) => {
    setNuevoAlumno(prev => {
      const act = prev.alergias.includes(tag) 
        ? prev.alergias.filter(a => a !== tag) 
        : [...prev.alergias, tag];
      return { ...prev, alergias: act };
    });
  };

  const handleToggleDay = (curso, dayNum) => {
    setFormActivitySchedule(prev => {
      const currentDays = prev[curso] || [];
      const newDays = currentDays.includes(dayNum)
        ? currentDays.filter(d => d !== dayNum)
        : [...currentDays, dayNum];
      
      const nextSchedule = { ...prev, [curso]: newDays };
      if (newDays.length === 0) {
        delete nextSchedule[curso];
      }
      return nextSchedule;
    });
  };

  const handleDeleteActivity = (activityId) => {
    if (!confirm("¿Seguro que deseas eliminar esta actividad?")) return;
    const nextActivities = (settings.actividades || []).filter(a => a.id !== activityId);
    onSave({
      ...settings,
      actividades: nextActivities
    });
    showToast("Actividad eliminada correctamente.", "info");
  };

  const handleSaveActivity = () => {
    if (!formActivityNombre.trim()) {
      alert("Por favor, introduce el nombre de la actividad.");
      return;
    }

    const stageCourses = formActivityEtapa === "Infantil" ? settings.cursosInfantil : settings.cursosPrimaria;
    const activeCursos = [];
    const finalSchedule = {};
    
    stageCourses.forEach(curso => {
      const days = formActivitySchedule[curso] || [];
      if (days.length > 0) {
        activeCursos.push(curso);
        finalSchedule[curso] = days.sort();
      }
    });

    if (activeCursos.length === 0) {
      alert("Debes programar al menos un día para algún curso.");
      return;
    }

    const activityId = editingActivity ? editingActivity.id : formActivityNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    const newActivity = {
      id: activityId,
      nombre: formActivityNombre.trim(),
      etapa: formActivityEtapa,
      cursos: activeCursos,
      schedule: finalSchedule,
      icon: formActivityIcon
    };

    let nextActivities = [...(settings.actividades || [])];
    if (editingActivity) {
      nextActivities = nextActivities.map(a => a.id === editingActivity.id ? newActivity : a);
    } else {
      if (nextActivities.some(a => a.id === activityId)) {
        alert("Ya existe una actividad con un nombre similar. Por favor, elige otro.");
        return;
      }
      nextActivities.push(newActivity);
    }

    onSave({
      ...settings,
      actividades: nextActivities
    });

    setEditingActivity(null);
    setFormActivityNombre("");
    setFormActivityEtapa("Primaria");
    setFormActivityIcon("BookOpen");
    setFormActivitySchedule({});
    showToast("Actividad guardada correctamente.", "success");
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-md border border-slate-200/60 dark:border-slate-800 overflow-hidden animate-fade-in">
      <div className="bg-slate-50 dark:bg-slate-850 px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex gap-2 items-center">
          <Settings className="w-5 h-5 text-blue-500"/> Configuración de Comedor
        </h3>
        
        <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-250 dark:border-slate-700 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setSettingsTab("general")} 
            className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded transition-all ${settingsTab === "general" ? "bg-white dark:bg-slate-700 text-blue-650 dark:text-blue-400 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
          >
            Ajustes Generales
          </button>
          <button 
            type="button"
            onClick={() => setSettingsTab("roster")} 
            className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded transition-all ${settingsTab === "roster" ? "bg-white dark:bg-slate-700 text-blue-650 dark:text-blue-400 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
          >
            Roster de Alérgenos
          </button>
          <button 
            type="button"
            onClick={() => setSettingsTab("activities")} 
            className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded transition-all ${settingsTab === "activities" ? "bg-white dark:bg-slate-700 text-blue-655 dark:text-blue-400 shadow-sm" : "text-slate-555 dark:text-slate-400 hover:text-slate-800"}`}
          >
            Actividades Extra
          </button>
        </div>
      </div>
      
      {settingsTab === "general" && (
        <div className="p-6 space-y-6 text-sm">
          <div className="space-y-2">
            <label className="block font-bold text-slate-755 dark:text-slate-300">
              Límite Máximo del Deslizador (Slider):
            </label>
            <input 
              type="number" 
              value={maxComensales} 
              onChange={e => setMaxComensales(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-955 font-medium text-slate-800 dark:text-slate-200"
              placeholder="35"
              min="5"
              max="100"
            />
            <p className="text-[10px] text-slate-400">Determina el valor máximo permitido al arrastrar el control de comensales fijos.</p>
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-slate-755 dark:text-slate-300">
              Letras de las clases (Separadas por comas):
            </label>
            <input 
              type="text" 
              value={letrasInput} 
              onChange={e => setLetrasInput(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-950 font-bold tracking-wider text-slate-800 dark:text-slate-200"
              placeholder="A, B, C"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-slate-755 dark:text-slate-300">
              Cursos de Educación Infantil (Separados por comas):
            </label>
            <input 
              type="text" 
              value={cursosInfantilInput} 
              onChange={e => setCursosInfantilInput(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-955 font-medium text-slate-800 dark:text-slate-200"
              placeholder="1º, 2º, 3º"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-slate-755 dark:text-slate-300">
              Cursos de Educación Primaria (Separados por comas):
            </label>
            <input 
              type="text" 
              value={cursosPrimariaInput} 
              onChange={e => setCursosPrimariaInput(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-950 font-medium text-slate-800 dark:text-slate-200"
              placeholder="1º, 2º, 3º, 4º, 5º, 6º"
            />
          </div>

          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <label className="block font-bold text-slate-755 dark:text-slate-300">
              Contraseña de Administración:
            </label>
            <input 
              type="text" 
              value={adminPassword} 
              onChange={e => setAdminPassword(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-205 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-150 dark:focus:ring-blue-950 font-bold text-slate-800 dark:text-slate-200"
              placeholder="comedorcsb"
            />
            <p className="text-[10px] text-slate-400">Clave requerida para entrar a las vistas de Cocina y Ajustes (Por defecto: comedorcsb).</p>
          </div>

          <button 
            type="button"
            onClick={handleSaveGeneral} 
            className="w-full bg-blue-650 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-98"
          >
            Guardar Ajustes Generales
          </button>
        </div>
      )}

      {settingsTab === "roster" && (
        <div className="p-6 space-y-6 text-sm">
          <div className="bg-slate-50 dark:bg-slate-855/45 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4 text-blue-505"/> Añadir Estudiante Estable al Roster
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nuevoAlumno.nombre} 
                  onChange={e => setNuevoAlumno(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-800 dark:text-slate-100"
                  placeholder="Ej: Sofía García"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Etapa</label>
                  <select 
                    value={nuevoAlumno.etapa} 
                    onChange={e => setNuevoAlumno(prev => ({ ...prev, etapa: e.target.value }))}
                    className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-850 dark:text-slate-100"
                  >
                    <option value="Infantil">Infantil</option>
                    <option value="Primaria">Primaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Curso</label>
                  <select 
                    value={nuevoAlumno.curso} 
                    onChange={e => setNuevoAlumno(prev => ({ ...prev, curso: e.target.value }))}
                    className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-855 dark:text-slate-100"
                  >
                    {cursosFormInput.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Letra</label>
                  <select 
                    value={nuevoAlumno.letra} 
                    onChange={e => setNuevoAlumno(prev => ({ ...prev, letra: e.target.value }))}
                    className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-855 dark:text-slate-100"
                  >
                    {settings.letras.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alergias Comunes</span>
              <div className="flex flex-wrap gap-1.5">
                {["Gluten", "Lactosa", "Huevo", "Frutos Secos", "Pescado"].map(tag => {
                  const active = nuevoAlumno.alergias.includes(tag);
                  return (
                    <button 
                      key={tag} 
                      type="button" 
                      onClick={() => toggleAllergyFormTag(tag)}
                      className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold border transition-all ${
                        active 
                          ? "bg-blue-650 border-blue-650 text-white shadow-sm" 
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-405 hover:border-slate-350"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col gap-1 text-left justify-end">
                <input 
                  type="text" 
                  placeholder="Otra alergia o nota adicional..." 
                  value={nuevoAlumno.nota}
                  onChange={e => setNuevoAlumno(prev => ({ ...prev, nota: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-800 dark:text-slate-100 text-sm"
                />
              </div>
              <label className="flex gap-2 items-center text-xs font-bold text-slate-650 dark:text-slate-400 cursor-pointer bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-755 w-full select-none h-[38px] self-end">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-green-600 rounded" 
                  checked={nuevoAlumno.dietaBlanda} 
                  onChange={e => setNuevoAlumno(prev => ({ ...prev, dietaBlanda: e.target.checked }))}
                /> 
                <span>Dieta Blanda (Arroz, pollo)</span>
              </label>
              
              <div className="flex flex-col gap-1 text-left">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Frecuencia Comedor</label>
                <select 
                  value={nuevoAlumno.tipoHabitual || "no_comedor"} 
                  onChange={e => setNuevoAlumno(prev => ({ ...prev, tipoHabitual: e.target.value }))}
                  className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer h-[38px]"
                >
                  <option value="no_comedor">No suele quedarse (No Comedor)</option>
                  <option value="fijo">Suele quedarse (Fijo)</option>
                </select>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleAddAlumnoRoster}
              className="w-full py-2.5 bg-blue-650 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wide mt-2"
            >
              Registrar Estudiante en el Roster
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="block text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Alumnos en la Base de Datos ({roster.length})</span>
              {roster.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateFrecuencia("fijo")}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-955/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded-lg transition-colors border border-blue-200/40 dark:border-blue-900/40 flex items-center gap-1"
                  >
                    <span>Fijos Todos (Suelen quedarse)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateFrecuencia("no_comedor")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                  >
                    <span>No Comedor Todos</span>
                  </button>
                </div>
              )}
            </div>
            
            {roster.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">No hay alumnos alérgicos registrados. Añade uno con el formulario superior.</div>
            ) : (
              <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {roster
                    .sort((a, b) => {
                      if (a.etapa !== b.etapa) return a.etapa.localeCompare(b.etapa);
                      if (a.curso !== b.curso) return a.curso.localeCompare(b.curso);
                      if (a.letra !== b.letra) return a.letra.localeCompare(b.letra);
                      return a.nombre.localeCompare(b.nombre); 
                    })
                    .map(student => (
                      <div key={student.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-205 flex items-center gap-2 flex-wrap">
                            <span>{student.nombre}</span>
                            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md ${student.etapa === 'Infantil' ? 'bg-pink-100 text-pink-700 dark:bg-pink-955/40 dark:text-pink-400' : 'bg-blue-100 text-blue-755 dark:bg-blue-955/40 dark:text-blue-400'}`}>
                              {student.etapa} {student.curso}-{student.letra}
                            </span>
                            {student.dietaBlanda && (
                              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-855 dark:text-emerald-300 px-1.5 py-0.2 rounded text-[9px] uppercase font-black">Blanda</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUpdateAlumnoRosterFrecuencia(student.id, student.tipoHabitual === 'no_comedor' ? 'fijo' : 'no_comedor')}
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 ${
                                student.tipoHabitual === 'no_comedor' 
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700' 
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-750 dark:bg-blue-955/20 dark:text-blue-450 dark:hover:bg-blue-955/40'
                              }`}
                              title="Haz clic para alternar la frecuencia predeterminada de este alumno"
                            >
                              <span>{student.tipoHabitual === 'no_comedor' ? 'No Comedor' : 'Fijo'}</span>
                              <span className="text-[8px] opacity-70">🔄</span>
                            </button>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{student.nota}</div>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => handleDeleteAlumnoRoster(student.id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-405 hover:text-red-650 rounded-lg transition-colors"
                          title="Eliminar de la Base de Datos"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {settingsTab === "activities" && (
        /* PANEL GESTIÓN ACTIVIDADES EXTRA */
        <div className="p-6 space-y-6 text-sm">
          {/* Formulario Añadir/Editar Actividad Extra */}
          <div className="bg-slate-50 dark:bg-slate-855/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-205 flex items-center gap-2 text-sm">
              {editingActivity ? <Edit3 className="w-4 h-4 text-blue-500"/> : <Plus className="w-4 h-4 text-blue-500"/>}
              <span>{editingActivity ? `Editar Actividad: ${editingActivity.nombre}` : "Crear Nueva Actividad Extra"}</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre de la Actividad</label>
                <input 
                  type="text" 
                  value={formActivityNombre} 
                  onChange={e => setFormActivityNombre(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold"
                  placeholder="Ej: Ajedrez, Teatro"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Etapa Escolar</label>
                <select 
                  value={formActivityEtapa} 
                  onChange={e => {
                    setFormActivityEtapa(e.target.value);
                    setFormActivitySchedule({}); // Resetear schedule al cambiar etapa
                  }}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-slate-855 dark:text-slate-100"
                >
                  <option value="Infantil">Infantil</option>
                  <option value="Primaria">Primaria</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Icono Visual</label>
                <select 
                  value={formActivityIcon} 
                  onChange={e => setFormActivityIcon(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-755 rounded-xl outline-none text-slate-855 dark:text-slate-100"
                >
                  <option value="BookOpen">📖 Libro Abierto (Catequesis)</option>
                  <option value="Bot">🤖 Robot (Robótica)</option>
                  <option value="Activity">⚡ Rayo / Deporte</option>
                  <option value="Award">🏆 Copa / Logros</option>
                  <option value="Music">🎵 Nota Musical</option>
                  <option value="Smile">😊 Carita Sonriente</option>
                  <option value="Bookmark">🔖 Marcapáginas</option>
                </select>
              </div>
            </div>

            {/* Selector de Días por Curso */}
            <div className="space-y-2 border-t border-slate-150 dark:border-slate-800 pt-3">
              <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Planificación de Días por Curso</span>
              <p className="text-[10px] text-slate-400">Selecciona los días de la semana en los que esta actividad se imparte para cada curso.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(formActivityEtapa === "Infantil" ? settings.cursosInfantil : settings.cursosPrimaria).map(curso => {
                  const selectedDays = formActivitySchedule[curso] || [];
                  return (
                    <div key={curso} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800 space-y-2">
                      <span className="font-bold text-slate-705 dark:text-slate-200 text-xs block">{curso} {formActivityEtapa}</span>
                      <div className="flex gap-1 justify-between">
                        {[
                          { val: 1, label: "L" },
                          { val: 2, label: "M" },
                          { val: 3, label: "X" },
                          { val: 4, label: "J" },
                          { val: 5, label: "V" }
                        ].map(day => {
                          const active = selectedDays.includes(day.val);
                          return (
                            <button
                              key={day.val}
                              type="button"
                              onClick={() => handleToggleDay(curso, day.val)}
                              className={`w-7 h-7 rounded-lg text-xs font-black border transition-all ${
                                active
                                  ? "bg-blue-650 border-blue-650 text-white shadow-sm"
                                  : "bg-slate-55/60 dark:bg-slate-855 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-350"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {editingActivity && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingActivity(null);
                    setFormActivityNombre("");
                    setFormActivityEtapa("Primaria");
                    setFormActivityIcon("BookOpen");
                    setFormActivitySchedule({});
                  }}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all text-xs uppercase tracking-wide"
                >
                  Cancelar Edición
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveActivity}
                className="flex-1 py-2.5 bg-blue-650 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-xs uppercase tracking-wide"
              >
                {editingActivity ? "Guardar Cambios de Actividad" : "Crear Nueva Actividad"}
              </button>
            </div>
          </div>

          {/* Listado de Actividades Registradas */}
          <div className="space-y-3">
            <span className="block text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Actividades Registradas ({(settings.actividades || []).length})</span>
            
            {(settings.actividades || []).length === 0 ? (
              <div className="p-8 text-center text-slate-405 italic">No hay actividades extra configuradas. Crea una con el formulario de arriba.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(settings.actividades || []).map(act => {
                  const IconComp = LucideReact[act.icon] || BookOpen;
                  return (
                    <div key={act.id} className="bg-slate-50/40 dark:bg-slate-855/20 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-start interactive-card text-left">
                      <div className="space-y-1.5 text-xs text-left w-full">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400 rounded-xl">
                            <IconComp className="w-4 h-4"/>
                          </span>
                          <div>
                            <h5 className="font-bold text-slate-805 dark:text-slate-100 text-sm">{act.nombre}</h5>
                            <span className="text-[9px] bg-blue-100 dark:bg-blue-955 text-blue-755 dark:text-blue-400 px-2 py-0.2 rounded font-extrabold uppercase">{act.etapa}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1 pl-1 pt-1">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Planificación semanal:</span>
                          {Object.entries(act.schedule || {}).map(([curso, days]) => {
                            const dayLabels = days.map(d => {
                              if (d === 1) return "Lunes";
                              if (d === 2) return "Martes";
                              if (d === 3) return "Miércoles";
                              if (d === 4) return "Jueves";
                              if (d === 5) return "Viernes";
                              return "";
                            }).join(", ");
                            return (
                              <div key={curso} className="text-slate-605 dark:text-slate-350">
                                <strong>{curso}</strong>: {dayLabels}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingActivity(act);
                            setFormActivityNombre(act.nombre);
                            setFormActivityEtapa(act.etapa);
                            setFormActivityIcon(act.icon);
                            setFormActivitySchedule(act.schedule || {});
                          }}
                          className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-405 hover:text-blue-655 rounded-xl transition-colors"
                          title="Editar Actividad"
                        >
                          <Edit3 className="w-4 h-4"/>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-2 hover:bg-red-55/10 dark:hover:bg-red-950/20 text-slate-405 hover:text-red-650 rounded-xl transition-colors"
                          title="Eliminar Actividad"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inicializar la aplicación React en el DOM
const rootEl = document.getElementById("app-root");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}
