import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Salad, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Save, 
  ShieldCheck, 
  RefreshCw,
  School,
  AlertTriangle
} from 'lucide-react';
import { AppSettings, StudentOperational, UserProfile } from '../types/comedor';
import { subscribeAllOperationalRoster, saveRosterStudent, deleteRosterStudent } from '../services/rosterService';
import { AccessibleModal } from './AccessibleModal';

interface SettingsViewProps {
  user: UserProfile;
  appSettings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  appSettings,
  onUpdateSettings,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'config'>('roster');
  const [roster, setRoster] = useState<StudentOperational[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para Añadir / Editar Alumno
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentOperational | null>(null);
  const [modalNombre, setModalNombre] = useState('');
  const [modalEtapa, setModalEtapa] = useState<'Infantil' | 'Primaria'>('Primaria');
  const [modalCurso, setModalCurso] = useState('1º');
  const [modalLetra, setModalLetra] = useState('A');
  const [modalNota, setModalNota] = useState('');
  const [modalBlanda, setModalBlanda] = useState(false);
  const [modalHabitual, setModalHabitual] = useState<'fijo' | 'no_comedor'>('fijo');
  const [savingStudent, setSavingStudent] = useState(false);

  // Escuchar Roster permanente
  useEffect(() => {
    setLoadingRoster(true);
    const unsubscribe = subscribeAllOperationalRoster((students) => {
      setRoster(students);
      setLoadingRoster(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredRoster = roster.filter(s => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(term) ||
      s.curso.toLowerCase().includes(term) ||
      s.letra.toLowerCase().includes(term) ||
      s.nota.toLowerCase().includes(term)
    );
  });

  const handleOpenNewStudent = () => {
    setEditingStudent(null);
    setModalNombre('');
    setModalEtapa('Primaria');
    setModalCurso('1º');
    setModalLetra('A');
    setModalNota('');
    setModalBlanda(false);
    setModalHabitual('fijo');
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudent = (student: StudentOperational) => {
    setEditingStudent(student);
    setModalNombre(student.nombre);
    setModalEtapa(student.etapa as any);
    setModalCurso(student.curso);
    setModalLetra(student.letra);
    setModalNota(student.nota);
    setModalBlanda(student.dietaBlanda);
    setModalHabitual(student.tipoHabitual || 'fijo');
    setIsStudentModalOpen(true);
  };

  const handleSaveStudentModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalNombre.trim() || !modalNota.trim()) {
      showToast('Por favor, completa el nombre y la dieta/alergia del alumno.', 'warning');
      return;
    }

    setSavingStudent(true);
    try {
      await saveRosterStudent({
        id: editingStudent ? editingStudent.id : undefined,
        nombre: modalNombre.trim(),
        etapa: modalEtapa,
        curso: modalCurso,
        letra: modalLetra,
        nota: modalNota.trim(),
        dietaBlanda: modalBlanda,
        tipoHabitual: modalHabitual
      }, user);

      showToast(
        editingStudent ? 'Alumno actualizado con éxito.' : 'Nuevo alumno alérgico añadido al Roster permanente.',
        'success'
      );
      setIsStudentModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Error al guardar el alumno en el Roster.', 'error');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (student: StudentOperational) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${student.nombre} del Roster permanente?`)) return;
    try {
      await deleteRosterStudent(student.id, student.nombre, user);
      showToast('Alumno eliminado del Roster.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar el alumno.', 'error');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 animate-fade-in">
      {/* Cabecera y Navegación de Ajustes */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Ajustes y Roster Escolar
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Gestión centralizada del alumnado con alergias y parámetros del comedor.
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('roster')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'roster'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🥗 Roster Alérgicos ({roster.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('config')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'config'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚙️ Configuración Centro
          </button>
        </div>
      </div>

      {/* Pestaña: Roster Permanente de Alérgicos */}
      {activeSubTab === 'roster' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar alumno, clase o alergia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={handleOpenNewStudent}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Añadir Alumno
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Alumno</th>
                  <th className="py-2.5 px-3">Aula</th>
                  <th className="py-2.5 px-3">Dieta / Alérgenos</th>
                  <th className="py-2.5 px-3">Modalidad</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredRoster.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {student.nombre}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-[11px]">
                        {student.curso} {student.letra} ({student.etapa})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-amber-700 dark:text-amber-300 font-semibold">
                      {student.nota}
                      {student.dietaBlanda && (
                        <span className="ml-1.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded text-[9.5px] font-bold">
                          Blanda
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {student.tipoHabitual === 'fijo' ? '🍽️ Habitual' : '🎫 Ocasional'}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditStudent(student)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-all"
                        title="Editar alumno"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                        title="Eliminar alumno"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRoster.length === 0 && !loadingRoster && (
              <div className="text-center py-8 text-xs text-slate-400 font-semibold">
                No se encontraron alumnos con los criterios de búsqueda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pestaña: Configuración General del Centro */}
      {activeSubTab === 'config' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 font-bold mb-1">
              Capacidad Máxima por Aula
            </label>
            <input
              type="number"
              value={appSettings.maxComensales}
              disabled
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <span className="block text-slate-500 font-bold mb-1">Cursos de Infantil:</span>
            <div className="flex gap-2">
              {appSettings.cursosInfantil.map(c => (
                <span key={c} className="bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 px-2.5 py-1 rounded-xl font-bold">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-slate-500 font-bold mb-1">Cursos de Primaria:</span>
            <div className="flex gap-2 flex-wrap">
              {appSettings.cursosPrimaria.map(c => (
                <span key={c} className="bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-xl font-bold">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Añadir / Editar Alumno */}
      <AccessibleModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title={editingStudent ? 'Editar Ficha de Alumno' : 'Añadir Alumno al Roster'}
      >
        <form onSubmit={handleSaveStudentModal} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Nombre y Apellidos</label>
            <input
              type="text"
              required
              value={modalNombre}
              onChange={(e) => setModalNombre(e.target.value)}
              placeholder="Ej. Lucas Martínez Gómez"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Etapa</label>
              <select
                value={modalEtapa}
                onChange={(e) => setModalEtapa(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
              >
                <option value="Infantil">Infantil</option>
                <option value="Primaria">Primaria</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Curso</label>
              <select
                value={modalCurso}
                onChange={(e) => setModalCurso(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
              >
                {(modalEtapa === 'Infantil' ? appSettings.cursosInfantil : appSettings.cursosPrimaria).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Letra</label>
              <select
                value={modalLetra}
                onChange={(e) => setModalLetra(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-800 dark:text-slate-100"
              >
                {appSettings.letras.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Dieta Especial / Alergias Operativas (Emplatado Cocina)
            </label>
            <input
              type="text"
              required
              value={modalNota}
              onChange={(e) => setModalNota(e.target.value)}
              placeholder="Ej. Celiaquía (Sin Gluten), Sin Huevo..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={modalBlanda}
                onChange={(e) => setModalBlanda(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Requiere Dieta Blanda</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={modalHabitual === 'fijo'}
                onChange={(e) => setModalHabitual(e.target.checked ? 'fijo' : 'no_comedor')}
                className="rounded text-blue-600"
              />
              <span>Comensal Habitual Fijo</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsStudentModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingStudent}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingStudent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{editingStudent ? 'Guardar Cambios' : 'Añadir al Roster'}</span>
            </button>
          </div>
        </form>
      </AccessibleModal>
    </div>
  );
};
