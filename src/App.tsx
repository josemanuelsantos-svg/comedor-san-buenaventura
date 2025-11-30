import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CheckCircle, ChefHat, Send, School, ArrowLeft, 
  Calendar, UtensilsCrossed, Ticket, History, 
  Lock, AlertCircle, Salad, Bot, BookOpen, Plus, Trash2,
  RefreshCw, WifiOff, ShieldCheck, Link2, HelpCircle, X,
  Shapes, Backpack, Info
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, onSnapshot, query, where } from "firebase/firestore";

// --- TUS CLAVES REALES DE FIREBASE ---
// Estas son las que me has pasado, ya configuradas.
const firebaseConfig = {
  apiKey: "AIzaSyBlgbaGrSIjdaqXI0SVbZgdim5z8uNzBxs",
  authDomain: "comedorcsb.firebaseapp.com",
  projectId: "comedorcsb",
  storageBucket: "comedorcsb.firebasestorage.app",
  messagingSenderId: "310874789678",
  appId: "1:310874789678:web:65442102af5aec75bd0cbf",
  measurementId: "G-CDLDNM330N"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Usamos tu ID de proyecto como identificador de la sala
// Si estás en el entorno de prueba, usará la variable interna, si no, tu ID real.
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;

const getLocalISODate = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return (new Date(d - offset)).toISOString().slice(0, 10);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('teacher'); 
  const [registros, setRegistros] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate());
  const [authError, setAuthError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        // Intento de conexión seguro
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error Auth:", error);
        if(mounted) setAuthError(true);
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

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    const targetDate = view === 'teacher' ? getLocalISODate() : selectedDate; 
    
    // Ruta de datos compatible con el entorno de pruebas y producción
    // En tu Firebase real se creará la colección 'artifacts' -> 'comedorcsb' -> ...
    const collectionPath = typeof __app_id !== 'undefined' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'registros_comedor')
      : collection(db, 'registros_comedor'); // Ruta simplificada para tu producción

    const q = query(collectionPath, where('fecha', '==', targetDate));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistros(data);
      setLoadingData(false);
    }, (err) => {
      console.error("Error Firestore:", err);
      setLoadingData(false);
    });
    return () => unsubscribe();
  }, [user, selectedDate, view]);

  if (!user && authError) return (
    <div className="p-10 text-center text-red-600 font-bold bg-red-50 h-screen flex flex-col items-center justify-center gap-4">
      <WifiOff className="w-12 h-12" />
      <p>Error de conexión. Verifica que el "Modo Anónimo" esté activado en Firebase Authentication.</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-lg">Reintentar</button>
    </div>
  );
  
  if (!user) return <div className="p-10 text-center text-slate-500 animate-pulse h-screen flex items-center justify-center">Cargando App...</div>;

  const syncId = appId.slice(0, 10).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 relative">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="bg-slate-800 text-white text-[10px] py-1 px-4 flex justify-center items-center gap-4">
          <div className="flex items-center gap-1">
             <Link2 className="w-3 h-3 text-green-400" />
             <span>SALA: <span className="font-bold text-yellow-400 font-mono">{syncId}</span></span>
          </div>
          <button onClick={()=>setShowHelp(true)} className="underline text-slate-400 hover:text-white">¿Ayuda?</button>
        </div>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm"><UtensilsCrossed className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="font-bold text-sm leading-none text-slate-800">Comedor SB</h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${loadingData ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
                <span className="text-[10px] text-slate-500 font-medium">{loadingData ? 'Sincronizando...' : 'Conectado'}</span>
              </div>
            </div>
          </div>
          <button onClick={() => { if (view === 'teacher') setSelectedDate(getLocalISODate()); setView(view === 'teacher' ? 'admin' : 'teacher'); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${view === 'admin' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
            {view === 'teacher' ? <><ChefHat className="w-4 h-4" /><span>Ver Cocina</span></> : <><Users className="w-4 h-4" /><span>Profesor</span></>}
          </button>
        </div>
      </header>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white p-6 rounded-xl max-w-xs w-full shadow-2xl relative">
             <button onClick={()=>setShowHelp(false)} className="absolute top-2 right-2 p-2"><X className="w-5 h-5 text-slate-400"/></button>
             <h3 className="font-bold text-lg mb-2">Conexión</h3>
             <p className="text-sm text-slate-600 mb-4">Código de sala: <strong>{syncId}</strong>.</p>
             <p className="text-sm text-slate-600">Si los datos no se ven, aseguraos de estar usando el mismo enlace web.</p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-4">
        {view === 'teacher' ? (
          <TeacherView db={db} user={user} registrosHoy={registros} appId={appId} />
        ) : (
          <AdminView registros={registros} selectedDate={selectedDate} setSelectedDate={setSelectedDate} loading={loadingData} />
        )}
      </main>
    </div>
  );
}

function TeacherView({ db, user, registrosHoy, appId }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ etapa: '', curso: '', letra: '', fijos: 0, tickets: 0, catequesis: 0, robotica: 0 });
  const [especiales, setEspeciales] = useState([]); 
  const [nuevoEspecial, setNuevoEspecial] = useState({ nombre: '', dietaBlanda: false, nota: '' });
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);

  const extraOptions = useMemo(() => {
    const dayOfWeek = new Date().getDay();
    let showCatequesis = false, showRobotica = false;
    if (formData.etapa === 'Primaria') {
        if (formData.curso === '3º' && dayOfWeek === 1) showCatequesis = true;
        if (formData.curso === '4º' && dayOfWeek === 2) showCatequesis = true;
        const cursosRoboticaMayores = ['4º', '5º', '6º'], cursosRoboticaPeques = ['1º', '2º', '3º'];
        if (cursosRoboticaMayores.includes(formData.curso) && (dayOfWeek === 1 || dayOfWeek === 3)) showRobotica = true;
        if (cursosRoboticaPeques.includes(formData.curso) && (dayOfWeek === 2 || dayOfWeek === 4)) showRobotica = true;
    }
    return { showCatequesis, showRobotica };
  }, [formData.etapa, formData.curso]);

  const resetForm = () => {
    setFormData({ etapa: '', curso: '', letra: '', fijos: 0, tickets: 0, catequesis: 0, robotica: 0 });
    setEspeciales([]);
    setNuevoEspecial({ nombre: '', dietaBlanda: false, nota: '' });
    setShowSpecialForm(false);
    setStep(1);
    setCompleted(false);
  };

  const handleInputChange = (field, value) => {
    let num = parseInt(value); if (isNaN(num)) num = 0; if (num < 0) num = 0; if (num > 35) num = 35;
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const addEspecial = () => {
    if (!nuevoEspecial.nombre.trim()) return;
    setEspeciales([...especiales, { ...nuevoEspecial, id: Date.now() }]);
    setNuevoEspecial({ nombre: '', dietaBlanda: false, nota: '' });
    setShowSpecialForm(false);
  };

  const currentTotal = (Number(formData.fijos) || 0) + (Number(formData.tickets) || 0);
  const yaRegistrado = useMemo(() => registrosHoy.find(r => r.etapa === formData.etapa && r.curso === formData.curso && r.letra === formData.letra), [registrosHoy, formData]);

  const handleSubmit = async () => {
    if (yaRegistrado) return;
    if (showSpecialForm && nuevoEspecial.nombre.trim().length > 0) {
        alert("⚠️ ATENCIÓN: Tienes un niño escrito pero NO añadido a la lista.\nPulsa el botón 'Añadir a la lista' antes de confirmar."); return;
    }
    setSending(true);
    const today = getLocalISODate();
    const docId = `${today}_${formData.etapa}_${formData.curso}_${formData.letra}`;
    
    // Determinamos la colección correcta dependiendo de si estamos en el entorno de pruebas o prod
    const collectionRef = typeof __app_id !== 'undefined' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'registros_comedor')
      : collection(db, 'registros_comedor');

    try {
      await setDoc(doc(collectionRef, docId), {
        fecha: today, timestamp: Date.now(), etapa: formData.etapa, curso: formData.curso, letra: formData.letra,
        fijos: Number(formData.fijos)||0, tickets: Number(formData.tickets)||0, total: currentTotal,
        catequesis: Number(formData.catequesis)||0, robotica: Number(formData.robotica)||0, especiales: especiales, registradoPor: user.uid
      });
      setSending(false); setCompleted(true);
    } catch (error) { 
      console.error("Error writing:", error);
      alert("Error al guardar en la base de datos."); 
      setSending(false); 
    }
  };

  if (completed) return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
      <CheckCircle className="w-20 h-20 text-green-500 mb-4 shadow-xl rounded-full bg-white" />
      <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Datos Enviados!</h2>
      <p className="text-slate-500 mb-6">{formData.curso} {formData.letra} registrado.</p>
      <button onClick={resetForm} className="bg-blue-600 text-white px-8 py-3 rounded-xl shadow-lg active:scale-95 transition-all font-bold">Registrar otro grupo</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="h-1.5 bg-slate-50 w-full"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} /></div>
      <div className="p-6">
        <div className="flex justify-between mb-6">
           <div className="flex gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider items-center">
             {step > 1 && <button onClick={() => setStep(s => s - 1)}><ArrowLeft className="w-5 h-5" /></button>} PASO {step}/3
           </div>
        </div>

        {step === 1 && (
          <div className="grid gap-3 animate-in slide-in-from-right">
            <button onClick={() => { setFormData({ ...formData, etapa: 'Infantil' }); setStep(2); }} className="flex items-center gap-4 p-4 border-2 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all group">
              <div className="p-3 rounded-full bg-pink-100 text-pink-500 group-hover:scale-110 transition-transform"><Shapes className="w-8 h-8" /></div><span className="text-lg font-bold text-slate-700">Infantil</span>
            </button>
            <button onClick={() => { setFormData({ ...formData, etapa: 'Primaria' }); setStep(2); }} className="flex items-center gap-4 p-4 border-2 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <div className="p-3 rounded-full bg-indigo-100 text-indigo-500 group-hover:scale-110 transition-transform"><Backpack className="w-8 h-8" /></div><span className="text-lg font-bold text-slate-700">Primaria</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <h2 className="text-xl font-bold text-center text-slate-800">Selecciona Grupo</h2>
            <div className="grid grid-cols-3 gap-2">
              {(formData.etapa === 'Infantil' ? ['1º', '2º', '3º'] : ['1º', '2º', '3º', '4º', '5º', '6º']).map(c => (
                <button key={c} onClick={() => setFormData({ ...formData, curso: c })} className={`py-3 rounded-lg font-bold text-lg transition-all ${formData.curso === c ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>{c}</button>
              ))}
            </div>
            {formData.curso && <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2">
              {['A', 'B', 'C'].map(l => (
                <button key={l} onClick={() => { setFormData({ ...formData, letra: l }); setTimeout(() => setStep(3), 150); }} className="py-4 border-2 rounded-lg font-bold text-xl hover:bg-blue-50 hover:border-blue-500 text-slate-600 transition-all">{l}</button>
              ))}
            </div>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="text-center pb-2 border-b border-slate-100"><h2 className="text-2xl font-black text-slate-800">{formData.curso} - {formData.letra}</h2></div>
            {yaRegistrado ? (
               <div className="bg-red-50 p-6 rounded-xl text-center border-red-200 border"><Lock className="w-8 h-8 text-red-500 mx-auto mb-2"/><p className="text-red-700 font-bold">Ya registrado hoy.</p><button onClick={() => setStep(1)} className="underline mt-2 text-sm">Volver</button></div>
            ) : (
              <>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-4 relative z-10"><span className="font-bold text-blue-800 flex gap-2 items-center"><Users className="w-5 h-5"/> Fijos (Menú)</span>
                     <div className="flex gap-2">
                       <button onClick={() => handleInputChange('fijos', formData.fijos - 1)} className="w-10 h-10 bg-white rounded-full border shadow-sm font-bold active:scale-90 transition-transform">-</button>
                       <input type="number" value={formData.fijos||''} onChange={e=>handleInputChange('fijos', e.target.value)} className="w-16 text-center text-3xl font-black bg-transparent outline-none" placeholder="0"/>
                       <button onClick={() => handleInputChange('fijos', formData.fijos + 1)} className="w-10 h-10 bg-white rounded-full border shadow-sm font-bold active:scale-90 transition-transform">+</button>
                     </div>
                   </div>
                   <input type="range" min="0" max="35" value={formData.fijos} onChange={e=>handleInputChange('fijos', e.target.value)} className="w-full h-3 bg-blue-200 rounded-lg accent-blue-600 relative z-10 cursor-pointer"/>
                   <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium px-1"><span>0</span><span>15</span><span>30</span></div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex justify-between items-center">
                   <span className="font-bold text-yellow-800 flex gap-2 items-center"><Ticket className="w-5 h-5"/> Tickets</span>
                   <div className="flex gap-2">
                       <button onClick={() => handleInputChange('tickets', formData.tickets - 1)} className="w-10 h-10 bg-white rounded-full border border-yellow-300 font-bold active:scale-90">-</button>
                       <input type="number" value={formData.tickets||''} onChange={e=>handleInputChange('tickets', e.target.value)} className="w-16 text-center text-3xl font-black bg-transparent outline-none text-yellow-900" placeholder="0"/>
                       <button onClick={() => handleInputChange('tickets', formData.tickets + 1)} className="w-10 h-10 bg-white rounded-full border border-yellow-300 font-bold active:scale-90">+</button>
                   </div>
                </div>

                {(extraOptions.showCatequesis || extraOptions.showRobotica) && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                    <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Actividades Extra</h3>
                    {extraOptions.showCatequesis && <div className="flex justify-between bg-white p-2 rounded border border-indigo-100 items-center"><span className="flex gap-2 text-sm font-bold text-indigo-700 items-center"><BookOpen className="w-4 h-4"/> Catequesis</span><div className="flex items-center gap-2"><button onClick={() => handleInputChange('catequesis', formData.catequesis - 1)} className="w-6 h-6 rounded bg-indigo-100 font-bold text-indigo-700">-</button><input type="number" className="w-8 text-center font-bold outline-none" value={formData.catequesis||''} onChange={e=>handleInputChange('catequesis', e.target.value)} placeholder="0"/><button onClick={() => handleInputChange('catequesis', formData.catequesis + 1)} className="w-6 h-6 rounded bg-indigo-100 font-bold text-indigo-700">+</button></div></div>}
                    {extraOptions.showRobotica && <div className="flex justify-between bg-white p-2 rounded border border-indigo-100 items-center"><span className="flex gap-2 text-sm font-bold text-indigo-700 items-center"><Bot className="w-4 h-4"/> Robótica</span><div className="flex items-center gap-2"><button onClick={() => handleInputChange('robotica', formData.robotica - 1)} className="w-6 h-6 rounded bg-indigo-100 font-bold text-indigo-700">-</button><input type="number" className="w-8 text-center font-bold outline-none" value={formData.robotica||''} onChange={e=>handleInputChange('robotica', e.target.value)} placeholder="0"/><button onClick={() => handleInputChange('robotica', formData.robotica + 1)} className="w-6 h-6 rounded bg-indigo-100 font-bold text-indigo-700">+</button></div></div>}
                  </div>
                )}

                <div className="bg-white border-2 border-slate-100 rounded-xl p-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3 text-sm uppercase tracking-wide"><Salad className="w-5 h-5 text-green-600"/> Dietas y Alergias</h3>
                  {especiales.map(esp => (
                    <div key={esp.id} className="flex justify-between items-center bg-green-50 p-2 rounded mb-2 border border-green-100">
                      <div><div className="font-bold text-sm text-slate-800">{esp.nombre}</div><div className="text-xs text-green-700">{esp.dietaBlanda && "Dieta Blanda. "}{esp.nota}</div></div>
                      <button onClick={() => setEspeciales(especiales.filter(e=>e.id!==esp.id))} className="p-2 hover:bg-green-100 rounded-full"><Trash2 className="w-4 h-4 text-red-400"/></button>
                    </div>
                  ))}
                  {!showSpecialForm ? <button onClick={() => setShowSpecialForm(true)} className="w-full py-3 border-2 border-dashed rounded-lg text-sm text-slate-500 font-bold flex justify-center gap-2 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all"><Plus className="w-4 h-4"/> Añadir Alumno</button> : 
                    <div className="bg-slate-50 p-4 rounded-lg space-y-3 border-2 border-blue-100 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-blue-600 font-bold text-xs"><Info className="w-3 h-3"/> Rellena y pulsa añadir</div>
                      <input className="w-full p-2 rounded border border-slate-300" placeholder="Nombre (Ej: Lucas)" value={nuevoEspecial.nombre} onChange={e=>setNuevoEspecial({...nuevoEspecial, nombre: e.target.value})}/>
                      <label className="flex gap-2 items-center text-sm font-bold text-slate-600 cursor-pointer bg-white p-2 rounded border border-slate-200"><input type="checkbox" className="w-4 h-4 accent-green-600" checked={nuevoEspecial.dietaBlanda} onChange={e=>setNuevoEspecial({...nuevoEspecial, dietaBlanda: e.target.checked})}/> Dieta Blanda</label>
                      <input className="w-full p-2 rounded border border-slate-300" placeholder="Alergia/Nota (Ej: Celiaco)" value={nuevoEspecial.nota} onChange={e=>setNuevoEspecial({...nuevoEspecial, nota: e.target.value})}/>
                      <div className="flex gap-2 pt-2"><button onClick={()=>setShowSpecialForm(false)} className="flex-1 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-500">Cancelar</button><button onClick={addEspecial} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm">Añadir a lista</button></div>
                    </div>
                  }
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4 px-2"><span className="font-bold text-slate-600">Total Platos:</span><span className="text-3xl font-black text-slate-800">{currentTotal}</span></div>
                  <button onClick={handleSubmit} disabled={sending} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">{sending ? <RefreshCw className="animate-spin"/> : <CheckCircle/>}{sending ? 'Enviando...' : 'CONFIRMAR REGISTRO'}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminView({ registros, selectedDate, setSelectedDate, loading }) {
  const stats = useMemo(() => {
    let totInf = 0, totPri = 0;
    const sorted = [...registros].sort((a,b) => (a.etapa > b.etapa ? 1 : a.etapa < b.etapa ? -1 : a.curso > b.curso ? 1 : a.curso < b.curso ? -1 : a.letra > b.letra ? 1 : -1));
    sorted.forEach(r => { 
        const t = (Number(r.fijos)||0) + (Number(r.tickets)||0); 
        if(r.etapa==='Infantil') totInf+=t; else totPri+=t; 
    });
    return { totInf, totPri, total: totInf+totPri, ordenados: sorted };
  }, [registros]);

  const handleSendEmail = () => {
    const d = new Date(selectedDate).toLocaleDateString('es-ES');
    let body = `COMEDOR ${d}\nTOTAL: ${stats.total} (Inf: ${stats.totInf}, Pri: ${stats.totPri})\n\n`;
    stats.ordenados.forEach(r => {
      const f=Number(r.fijos)||0, t=Number(r.tickets)||0;
      body += `${r.etapa} ${r.curso}-${r.letra}: ${f+t} (${f} fijos, ${t} tickets)`;
      if(r.catequesis) body+=` | Cat: ${r.catequesis}`; if(r.robotica) body+=` | Rob: ${r.robotica}`;
      body+='\n';
      if(r.especiales?.length) r.especiales.forEach(e => body+=`   -> ${e.nombre}: ${e.dietaBlanda?'Blanda. ':''}${e.nota||''}\n`);
    });
    window.location.href = `mailto:comedor@sanbuenaventura.org?subject=Comedor ${d}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
         <div className="flex gap-2 font-bold text-slate-700 items-center"><History className="text-blue-600"/> Historial</div>
         <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer"/>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-pink-50 p-2 rounded border border-pink-100"><div className="text-xs font-bold text-pink-500">INFANTIL</div><div className="text-xl font-black text-pink-700">{stats.totInf}</div></div>
        <div className="bg-indigo-50 p-2 rounded border border-indigo-100"><div className="text-xs font-bold text-indigo-500">PRIMARIA</div><div className="text-xl font-black text-indigo-700">{stats.totPri}</div></div>
        <div className="bg-green-50 p-2 rounded border border-green-100"><div className="text-xs font-bold text-green-500">TOTAL</div><div className="text-xl font-black text-green-700">{stats.total}</div></div>
      </div>
      <button onClick={handleSendEmail} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow flex justify-center gap-2 active:scale-95 transition-all"><Send className="w-4 h-4"/> Generar Correo</button>
      <div className="bg-white rounded-xl shadow overflow-hidden divide-y">
        <div className="bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 flex justify-between"><span>Detalle</span>{loading && <RefreshCw className="animate-spin w-4 h-4"/>}</div>
        {stats.ordenados.map(r => (
            <div key={r.id} className="p-4 hover:bg-slate-50">
               <div className="flex justify-between font-bold text-slate-700 mb-1"><span>{r.etapa[0]}. {r.curso} {r.letra}</span><span className="text-black text-lg">{(r.fijos||0)+(r.tickets||0)}</span></div>
               <div className="text-xs text-slate-500 mb-1 flex flex-wrap gap-2">
                   <span className="bg-blue-100 text-blue-700 px-1 rounded">{r.fijos||0} Fijos</span>
                   <span className="bg-yellow-100 text-yellow-700 px-1 rounded">{r.tickets||0} Tickets</span>
                   {r.catequesis>0 && <span className="bg-indigo-100 text-indigo-700 px-1 rounded flex gap-1 items-center"><BookOpen className="w-3 h-3"/> {r.catequesis}</span>}
                   {r.robotica>0 && <span className="bg-indigo-100 text-indigo-700 px-1 rounded flex gap-1 items-center"><Bot className="w-3 h-3"/> {r.robotica}</span>}
               </div>
               {r.especiales?.length > 0 && <div className="mt-2 pl-2 border-l-4 border-green-400 bg-green-50 rounded py-1 text-sm space-y-1">
                   {r.especiales.map((e,i)=><div key={i}><strong>{e.nombre}</strong>: {e.dietaBlanda?'Blanda. ':''}{e.nota}</div>)}
               </div>}
            </div>
        ))}
        {stats.ordenados.length===0 && <div className="p-8 text-center text-slate-400">Sin datos hoy.</div>}
      </div>
    </div>
  );
}