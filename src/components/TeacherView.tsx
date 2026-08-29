import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CheckCircle, 
  School, 
  Calendar, 
  UtensilsCrossed, 
  Ticket, 
  Salad, 
  Plus, 
  Minus, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  X, 
  Send, 
  ArrowLeft,
  Backpack,
  Edit3,
  Bookmark,
  Activity,
  History
} from 'lucide-react';
import { 
  UserProfile, 
  DailyRecord, 
  StudentOperational, 
  AppSettings 
} from '../types/comedor';
import { saveDailyAttendance, subscribeClassDailyRecord } from '../services/attendanceService';
import { subscribeClassRoster } from '../services/rosterService';
import { calculateClassTotal, calculateMenuBreakdown } from '../utils/mathUtils';
import { getLocalISODate, formatHumanDate } from '../utils/dateUtils';

interface TeacherViewProps {
  user: UserProfile;
  appSettings: AppSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({
  user,
  appSettings,
  showToast
}) => {
  // Estado del flujo de pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [etapa, setEtapa] = useState<'Infantil' | 'Primaria'>('Primaria');
  const [curso, setCurso] = useState<string>('');
  const [letra, setLetra] = useState<string>('');

  // Formulario de Asistencia
  const [fijos, setFijos] = useState<number>(0);
  const [tickets, setTickets] = useState<number>(0);
  const [profesorSeQueda, setProfesorSeQueda] = useState<boolean>(false);
  const [profesorNombre, setProfesorNombre] = useState<string>(user.displayName || '');
  const [observaciones, setObservaciones] = useState<string>('');

  // Modalidad Picnic / Excursión
  const [esExcursion, setEsExcursion] = useState<boolean>(false);
  const [fechaExcursion, setFechaExcursion] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getLocalISODate(tomorrow);
  });

  // Roster y Asistencia de Alumnos Alérgicos
  const [rosterAlumnos, setRosterAlumnos] = useState<StudentOperational[]>([]);
  const [attendance, setAttendance] = useState<Record<string, StudentOperational & { option: 'comedor' | 'ticket' | 'picnic' | 'falta' }>>({});
  const [expandedStudentOptions, setExpandedStudentOptions] = useState<Record<string, boolean>>({});
  
  // Dietas Especiales Puntuales (Manuales de hoy)
  const [manualEspeciales, setManualEspeciales] = useState<StudentOperational[]>([]);
  const [nuevoEspecialNombre, setNuevoEspecialNombre] = useState('');
  const [nuevoEspecialNota, setNuevoEspecialNota] = useState('');
  const [nuevoEspecialBlanda, setNuevoEspecialBlanda] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Registro existente para la fecha
  const [existingRecord, setExistingRecord] = useState<DailyRecord | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  // Cargar clase por defecto si está guardada
  useEffect(() => {
    const saved = localStorage.getItem(`comedor_default_class_${user.uid}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.etapa && parsed.curso && parsed.letra) {
          setEtapa(parsed.etapa);
          setCurso(parsed.curso);
          setLetra(parsed.letra);
          setStep(3);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [user.uid]);

  // Escuchar Roster permanente del aula
  useEffect(() => {
    if (step !== 3 || !etapa || !curso || !letra) return;

    const unsubscribe = subscribeClassRoster(etapa, curso, letra, (students) => {
      setRosterAlumnos(students);
      setAttendance(prev => {
        const nextAtt = { ...prev };
        students.forEach(s => {
          if (!nextAtt[s.id]) {
            nextAtt[s.id] = {
              ...s,
              option: s.tipoHabitual === 'fijo' ? (esExcursion ? 'picnic' : 'comedor') : 'falta'
            };
          }
        });
        return nextAtt;
      });
    });

    return () => unsubscribe();
  }, [step, etapa, curso, letra, esExcursion]);

  // Escuchar si ya existe un registro para esta clase hoy o en la fecha de excursión
  useEffect(() => {
    if (step !== 3 || !etapa || !curso || !letra) return;

    const targetDate = esExcursion && fechaExcursion ? fechaExcursion : getLocalISODate();
    const unsubscribe = subscribeClassDailyRecord(targetDate, etapa, curso, letra, (record) => {
      setExistingRecord(record);
      if (record && !isEditing) {
        // Precargar valores si existe
        setFijos(record.fijos || 0);
        setTickets(record.tickets || 0);
        setProfesorSeQueda(record.profesorSeQueda || false);
        setProfesorNombre(record.profesorNombre || '');
        setObservaciones(record.observaciones || '');
        setEsExcursion(record.modalidad === 'picnic');
      }
    });

    return () => unsubscribe();
  }, [step, etapa, curso, letra, esExcursion, fechaExcursion, isEditing]);

  // Cálculo del total reactivo
  const currentTotal = useMemo(() => {
    return calculateClassTotal(fijos, tickets, profesorSeQueda);
  }, [fijos, tickets, profesorSeQueda]);

  // Conteo de alumnos especiales que comen hoy
  const especialesPresentes = useMemo(() => {
    const fromRoster = rosterAlumnos.filter(s => {
      const att = attendance[s.id];
      return att && att.option !== 'falta';
    }).map(s => ({
      ...s,
      option: attendance[s.id]?.option || 'comedor'
    }));

    const fromManual = manualEspeciales.map(m => ({
      ...m,
      option: (esExcursion ? 'picnic' : 'comedor') as const
    }));

    return [...fromRoster, ...fromManual];
  }, [rosterAlumnos, attendance, manualEspeciales, esExcursion]);

  const especialesAusentes = useMemo(() => {
    return rosterAlumnos.filter(s => {
      const att = attendance[s.id];
      return !att || att.option === 'falta';
    });
  }, [rosterAlumnos, attendance]);

  const dietasBlandas = useMemo(() => {
    return especialesPresentes.filter(s => s.dietaBlanda);
  }, [especialesPresentes]);

  // Manejador de opción de asistencia para alumno
  const handleUpdateStudentOption = (studentId: string, option: 'comedor' | 'ticket' | 'picnic' | 'falta') => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || rosterAlumnos.find(s => s.id === studentId)!),
        option
      }
    }));
  };

  // Guardar clase habitual
  const handleToggleDefaultClass = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      localStorage.setItem(`comedor_default_class_${user.uid}`, JSON.stringify({ etapa, curso, letra }));
      showToast('Aula guardada como tu clase habitual.', 'info');
    } else {
      localStorage.removeItem(`comedor_default_class_${user.uid}`);
      showToast('Aula desmarcada como habitual.', 'info');
    }
  };

  // Añadir alumno manual puntual
  const handleAddManualSpecial = () => {
    if (!nuevoEspecialNombre.trim()) {
      showToast('Por favor, escribe el nombre del alumno.', 'warning');
      return;
    }
    const newStudent: StudentOperational = {
      id: `manual_${Date.now()}`,
      nombre: nuevoEspecialNombre.trim(),
      etapa,
      curso,
      letra,
      nota: nuevoEspecialNota.trim() || (nuevoEspecialBlanda ? 'Dieta Blanda' : 'Dieta Especial'),
      dietaBlanda: nuevoEspecialBlanda,
      tipoHabitual: 'no_comedor',
      esManual: true
    };
    setManualEspeciales(prev => [...prev, newStudent]);
    setNuevoEspecialNombre('');
    setNuevoEspecialNota('');
    setNuevoEspecialBlanda(false);
    setShowManualForm(false);
    showToast('Alumno con dieta puntual añadido para hoy.', 'success');
  };

  // Envío final del formulario a Cocina
  const handleSubmit = async () => {
    if (profesorSeQueda && !profesorNombre.trim()) {
      showToast('Has marcado que el profesor/a come, por favor introduce su nombre.', 'warning');
      return;
    }

    if (esExcursion && !fechaExcursion) {
      showToast('Por favor, selecciona la fecha válida de la excursión.', 'warning');
      return;
    }

    setSending(true);
    try {
      const recordData = {
        fecha: esExcursion && fechaExcursion ? fechaExcursion : getLocalISODate(),
        etapa,
        curso,
        letra,
        autorUid: user.uid,
        autorNombre: user.displayName || user.email,
        fijos,
        tickets,
        profesorSeQueda,
        profesorNombre: profesorSeQueda ? profesorNombre.trim() : '',
        modalidad: (esExcursion ? 'picnic' : 'comedor') as 'comedor' | 'picnic',
        fechaExcursion: esExcursion ? fechaExcursion : undefined,
        especiales: especialesPresentes,
        especialesPresentes,
        especialesAusentes,
        dietasBlandas,
        observaciones: observaciones.trim(),
        estado: (existingRecord ? 'corregido' : 'enviado') as any
      };

      const res = await saveDailyAttendance({
        record: recordData as any,
        user,
        isCorrection: !!existingRecord
      });

      if (res.success) {
        showToast(
          isEditing ? '¡Modificaciones enviadas a Cocina!' : '¡Asistencia registrada y enviada a Cocina con éxito!',
          'success'
        );
        setIsEditing(false);
      } else {
        showToast(res.error || 'Error al guardar el registro.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error de red al enviar la asistencia.', 'error');
    } finally {
      setSending(false);
    }
  };

  const cursosDisponibles = etapa === 'Infantil' ? appSettings.cursosInfantil : appSettings.cursosPrimaria;
  const isDefaultClass = (() => {
    try {
      const saved = localStorage.getItem(`comedor_default_class_${user.uid}`);
      if (!saved) return false;
      const p = JSON.parse(saved);
      return p.etapa === etapa && p.curso === curso && p.letra === letra;
    } catch {
      return false;
    }
  })();

  return (
    <div className="max-w-xl mx-auto pb-32 animate-fade-in">
      {/* Paso 1: Selección de Etapa */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full">
              Paso 1 de 2
            </span>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">
              Selecciona la Etapa
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setEtapa('Infantil'); setStep(2); }}
              className="p-5 rounded-2xl bg-pink-50/60 dark:bg-pink-950/20 hover:bg-pink-100/80 border-2 border-pink-200 dark:border-pink-900/60 text-center transition-all active:scale-95 group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🧸</div>
              <div className="font-black text-sm text-pink-900 dark:text-pink-300">Infantil</div>
            </button>

            <button
              type="button"
              onClick={() => { setEtapa('Primaria'); setStep(2); }}
              className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/80 border-2 border-blue-200 dark:border-blue-900/60 text-center transition-all active:scale-95 group"
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🎒</div>
              <div className="font-black text-sm text-blue-900 dark:text-blue-300">Primaria</div>
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Selección de Curso y Letra */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full">
              Paso 2 de 2
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
              ¿Qué clase pasará lista?
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Etapa: <strong className="text-blue-600">{etapa}</strong>
            </p>
          </div>

          {/* Selector de Cursos */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Curso:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {cursosDisponibles.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurso(c)}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${
                    curso === c
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Letras */}
          {curso && (
            <div className="pt-2 animate-slide-up">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Grupo / Letra:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {appSettings.letras.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { setLetra(l); setStep(3); }}
                    className={`py-3 rounded-xl font-black text-sm transition-all ${
                      letra === l
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Grupo {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Pase de Lista y Formulario Detallado */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Cabecera del Aula Seleccionada */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                aria-label="Cambiar de clase"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Cambiar aula"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {etapa}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Aula {curso} {letra}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={isDefaultClass}
                  onChange={handleToggleDefaultClass}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Recordar</span>
              </label>
            </div>
          </div>

          {/* Aviso si ya fue enviado hoy */}
          {existingRecord && !isEditing && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-3xl p-4 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                    Asistencia enviada a Cocina ({existingRecord.totalPlatos} platos)
                  </div>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                    Por {existingRecord.autorNombre} a las {new Date(existingRecord.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </button>
            </div>
          )}

          {/* Bloque Modalidad Picnic / Excursión */}
          <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/60 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Backpack className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-black text-purple-900 dark:text-purple-300">
                  ¿Es para una excursión? (Bolsa Picnic)
                </span>
              </div>
              <input
                type="checkbox"
                checked={esExcursion}
                onChange={(e) => setEsExcursion(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {esExcursion && (
              <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/60 animate-slide-up flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-[11px] font-bold text-purple-800 dark:text-purple-300">
                  Fecha de la excursión:
                </label>
                <input
                  type="date"
                  value={fechaExcursion}
                  min={getLocalISODate()}
                  onChange={(e) => setFechaExcursion(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            )}
          </div>

          {/* Contadores Principales: Fijos y Tickets */}
          <div className="grid grid-cols-2 gap-3">
            {/* Fijos */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Alumnos Fijos
              </span>
              <div className="text-3xl font-black text-slate-800 dark:text-slate-100 my-2">
                {fijos}
              </div>
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  aria-label="Restar un alumno fijo"
                  onClick={() => setFijos(prev => Math.max(0, prev - 1))}
                  className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center font-black text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Añadir un alumno fijo"
                  onClick={() => setFijos(prev => prev + 1)}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center font-black active:scale-95 transition-all shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tickets Sueltos */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Tickets Sueltos
              </span>
              <div className="text-3xl font-black text-slate-800 dark:text-slate-100 my-2">
                {tickets}
              </div>
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  aria-label="Restar un ticket"
                  onClick={() => setTickets(prev => Math.max(0, prev - 1))}
                  className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center font-black text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Añadir un ticket"
                  onClick={() => setTickets(prev => prev + 1)}
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center font-black active:scale-95 transition-all shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Profesor/a come hoy */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                ¿El profesor/a come hoy en el comedor? (+1 ración)
              </span>
              <input
                type="checkbox"
                checked={profesorSeQueda}
                onChange={(e) => setProfesorSeQueda(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </div>
            {profesorSeQueda && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 animate-slide-up">
                <input
                  type="text"
                  placeholder="Nombre del profesor/a..."
                  value={profesorNombre}
                  onChange={(e) => setProfesorNombre(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Bloque Alumnos con Dietas Especiales y Alergias (52px Touch Targets) */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Salad className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Dietas Especiales y Alergias
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                {rosterAlumnos.length} registrados
              </span>
            </div>

            {/* Listado de Alumnos del Roster */}
            {rosterAlumnos.length > 0 && (
              <div className="space-y-3">
                {rosterAlumnos.map(student => {
                  const att = attendance[student.id] || { option: 'falta' };
                  const currentOption = att.option;
                  const isAttending = currentOption === 'comedor' || currentOption === 'ticket' || currentOption === 'picnic';
                  const isAbsent = currentOption === 'falta';
                  const isExpanded = !!expandedStudentOptions[student.id];

                  const noteLower = (student.nota || '').toLowerCase();
                  const isCritical = noteLower.includes('adrenalina') || 
                                     noteLower.includes('grave') || 
                                     noteLower.includes('estilsona') ||
                                     noteLower.includes('altellus') ||
                                     noteLower.includes('jext') ||
                                     noteLower.includes('anapen');

                  return (
                    <div 
                      key={student.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all shadow-sm ${
                        isCritical 
                          ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-800/70' 
                          : isAttending
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-300 dark:border-emerald-800/60'
                            : 'bg-slate-50/60 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-sm sm:text-base text-slate-800 dark:text-slate-100">
                              {student.nombre}
                            </span>
                            {isCritical && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-red-500 text-white animate-pulse shadow-sm">
                                <AlertTriangle className="w-3 h-3" /> ALERTA GRAVE
                              </span>
                            )}
                            {student.dietaBlanda && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Dieta Blanda
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 flex items-start gap-1.5">
                            <Salad className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span>{student.nota}</span>
                          </div>
                        </div>

                        {/* Opciones avanzadas */}
                        <button
                          type="button"
                          onClick={() => setExpandedStudentOptions(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                          className="p-1.5 px-2 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {currentOption === 'ticket' ? '🏷️ Ticket' : currentOption === 'picnic' ? '🎒 Picnic' : '⚙️ Más'}
                        </button>
                      </div>

                      {/* Selector Binario Táctil (≥48px altura) */}
                      <div className="grid grid-cols-2 gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateStudentOption(student.id, esExcursion ? 'picnic' : 'comedor')}
                          className={`h-12 py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                            isAttending
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>COME HOY</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateStudentOption(student.id, 'falta')}
                          className={`h-12 py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                            isAbsent
                              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <X className="w-4 h-4 stroke-[3]" />
                          <span>FALTA</span>
                        </button>
                      </div>

                      {/* Desplegable de Ticket o Picnic */}
                      {isExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex gap-2 justify-end animate-slide-up">
                          <button
                            type="button"
                            onClick={() => handleUpdateStudentOption(student.id, 'ticket')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentOption === 'ticket' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            🏷️ Ticket Suelto
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStudentOption(student.id, 'picnic')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentOption === 'picnic' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            🎒 Picnic
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dietas Puntuales Manuales Añadidas Hoy */}
            {manualEspeciales.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dietas añadidas manualmente para hoy:
                </span>
                {manualEspeciales.map((m, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                        {m.nombre} {m.dietaBlanda && <span className="bg-amber-200 text-amber-900 px-1 py-0.5 rounded text-[9px] font-bold">Blanda</span>}
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">{m.nota}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualEspeciales(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botón para añadir dieta puntual */}
            {!showManualForm ? (
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir alumno con dieta puntual hoy
              </button>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-700 animate-slide-up">
                <input
                  type="text"
                  placeholder="Nombre y apellidos del alumno..."
                  value={nuevoEspecialNombre}
                  onChange={(e) => setNuevoEspecialNombre(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Alergia o requerimiento dietético (ej. Sin huevo)..."
                  value={nuevoEspecialNota}
                  onChange={(e) => setNuevoEspecialNota(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={nuevoEspecialBlanda}
                    onChange={(e) => setNuevoEspecialBlanda(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Requiere Dieta Blanda</span>
                </label>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualSpecial}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm"
                  >
                    Añadir Alumno
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones (Separadas estrictamente de ausencias) */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Observaciones / Incidencias para Cocina
            </label>
            <textarea
              rows={2}
              placeholder="Escribe aquí cualquier nota relevante para el servicio de hoy..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Barra Flotante Inferior Ergonómica (Thumb-Zone para Móvil) */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 z-30 shadow-2xl print:hidden">
            <div className="max-w-xl mx-auto flex items-center gap-3">
              <div className="flex flex-col min-w-[90px] pl-1">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                  Total Platos
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {currentTotal}
                  </span>
                  {especialesPresentes.length > 0 && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      ({especialesPresentes.length} esp)
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={sending}
                onClick={handleSubmit}
                className="flex-1 h-13 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-75"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {isEditing 
                        ? 'CONFIRMAR MODIFICACIONES' 
                        : (esExcursion ? 'SOLICITAR PICNICS A COCINA' : '⚡ CONFIRMAR Y ENVIAR A COCINA')}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
