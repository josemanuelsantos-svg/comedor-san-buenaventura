import React from 'react';
import { 
  Users, 
  ChefHat, 
  Settings, 
  History, 
  Moon, 
  Sun, 
  LogOut, 
  Wifi, 
  WifiOff, 
  ShieldCheck 
} from 'lucide-react';
import { UserProfile } from '../types/comedor';

interface NavbarProps {
  user: UserProfile;
  currentView: 'teacher' | 'kitchen' | 'audit' | 'settings';
  onViewChange: (view: 'teacher' | 'kitchen' | 'audit' | 'settings') => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isOnline: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  onViewChange,
  isDarkMode,
  onToggleDarkMode,
  isOnline,
  onLogout
}) => {
  const getRoleLabel = () => {
    switch (user.rol) {
      case 'admin': return 'Administración';
      case 'kitchen': return 'Cocina';
      case 'nutrition_or_medical': return 'Dietista / Médico';
      case 'teacher':
      default: return 'Profesorado';
    }
  };

  const getRoleBadgeColor = () => {
    switch (user.rol) {
      case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'kitchen': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'nutrition_or_medical': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Logo y Nombre */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 shrink-0">
            🍽️
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              Comedor SB
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeColor()}`}>
                {getRoleLabel()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px] sm:max-w-[200px]" title={user.displayName}>
                {user.displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Botonera Central de Vistas */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          {(user.rol === 'teacher' || user.rol === 'admin') && (
            <button
              type="button"
              onClick={() => onViewChange('teacher')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'teacher'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" /> Pase de Lista
            </button>
          )}

          {(user.rol === 'kitchen' || user.rol === 'admin') && (
            <button
              type="button"
              onClick={() => onViewChange('kitchen')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'kitchen'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ChefHat className="w-4 h-4" /> Control Cocina
            </button>
          )}

          {user.rol === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => onViewChange('audit')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'audit'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History className="w-4 h-4" /> Auditoría
              </button>

              <button
                type="button"
                onClick={() => onViewChange('settings')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'settings'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" /> Ajustes
              </button>
            </>
          )}
        </nav>

        {/* Controles de Estado y Sesión */}
        <div className="flex items-center gap-2">
          {/* Indicador Online/Offline */}
          <div 
            title={isOnline ? 'Conexión activa con Firebase' : 'Modo sin conexión (guardado local)'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
              isOnline 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 animate-pulse" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Selector Modo Oscuro */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Cerrar Sesión */}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión segura"
            className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all flex items-center gap-1 font-bold text-xs"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
