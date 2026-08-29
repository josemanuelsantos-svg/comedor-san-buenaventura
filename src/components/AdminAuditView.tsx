import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  Calendar, 
  User, 
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuditLogEntry, UserProfile } from '../types/comedor';
import { formatHumanDate } from '../utils/dateUtils';

interface AdminAuditViewProps {
  user: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminAuditView: React.FC<AdminAuditViewProps> = ({ user, showToast }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const entries: AuditLogEntry[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AuditLogEntry));
      setLogs(entries);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
      showToast('Error al cargar los registros de auditoría.', 'error');
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'ALL' && log.action !== filterAction) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.userName || '').toLowerCase().includes(term) ||
      (log.action || '').toLowerCase().includes(term) ||
      (log.targetId || '').toLowerCase().includes(term) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(term)
    );
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE_RECORD': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      case 'UPDATE_RECORD': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      case 'CONFIRM_RECORD': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'LOGIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
      case 'LOGOUT': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
      case 'UPDATE_ROSTER': return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 animate-fade-in">
      {/* Cabecera y Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Registro Inmutable de Auditoría
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Trazabilidad de accesos, modificaciones de asistencia y gestión de datos médicos.
              </p>
            </div>
          </div>
          {loading && <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por usuario, aula, alérgeno o acción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="ALL">Todas las acciones</option>
            <option value="CREATE_RECORD">Creación de Asistencia</option>
            <option value="UPDATE_RECORD">Modificación de Asistencia</option>
            <option value="CONFIRM_RECORD">Confirmación de Cocina</option>
            <option value="UPDATE_ROSTER">Gestión de Alumnos/Dietas</option>
            <option value="LOGIN">Inicios de Sesión</option>
            <option value="LOGOUT">Cierres de Sesión</option>
          </select>
        </div>
      </div>

      {/* Listado de Logs */}
      <div className="space-y-2">
        {filteredLogs.map(log => {
          const isExpanded = expandedLogId === log.id;
          return (
            <div 
              key={log.id} 
              className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-sm text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9.5px] uppercase ${getActionBadgeColor(log.action)}`}>
                    {log.action}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {log.userName}
                  </span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-semibold">
                    Rol: {log.userRole}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-400 font-medium">
                  {new Date(log.timestamp).toLocaleString('es-ES')}
                </div>
              </div>

              <div className="text-slate-600 dark:text-slate-300 font-medium">
                Objetivo: <strong className="text-slate-800 dark:text-slate-100">{log.targetId}</strong> ({log.targetType})
              </div>

              {log.details && (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 overflow-x-auto">
                  {JSON.stringify(log.details)}
                </div>
              )}

              {log.diff && (
                <button
                  type="button"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id!)}
                  className="text-purple-600 dark:text-purple-400 text-[11px] font-bold flex items-center gap-1 hover:underline"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{isExpanded ? 'Ocultar cambios (diff)' : 'Ver diferencias (diff)'}</span>
                </button>
              )}

              {isExpanded && log.diff && (
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-1 text-[10.5px] font-mono animate-slide-up">
                  <div className="text-slate-500 font-bold">Antes:</div>
                  <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap">{JSON.stringify(log.diff.before, null, 2)}</pre>
                  <div className="text-slate-500 font-bold mt-1">Después:</div>
                  <pre className="text-emerald-600 dark:text-emerald-400 whitespace-pre-wrap">{JSON.stringify(log.diff.after, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}

        {filteredLogs.length === 0 && !loading && (
          <div className="text-center py-12 text-xs text-slate-400 font-semibold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            No se encontraron eventos de auditoría con los filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
};
