import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  RefreshCw, 
  ArrowRight, 
  School,
  AlertCircle 
} from 'lucide-react';
import { loginWithGoogle, loginWithEmail, DEFAULT_DEMO_USERS } from '../services/authService';
import { UserProfile } from '../types/comedor';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'email'>('quick');

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const profile = await loginWithGoogle();
      showToast(`¡Bienvenido/a, ${profile.displayName}!`, 'success');
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al iniciar sesión con Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Por favor, introduce tu email institucional y contraseña.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const profile = await loginWithEmail(email, password);
      showToast(`¡Bienvenido/a, ${profile.displayName}!`, 'success');
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      showToast('Credenciales incorrectas o usuario no registrado.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    try {
      // Usamos una contraseña fija interna para las cuentas escolares preconfiguradas
      const profile = await loginWithEmail(demoEmail, "ComedorSB2026!");
      showToast(`Accediendo como ${profile.displayName}...`, 'success');
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      showToast('Error al iniciar sesión rápida.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-scale-up">
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-xl shadow-blue-500/25 mx-auto mb-3">
            🍽️
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Comedor SB
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Colegio San Buenaventura — Gestión Segura de Comensales
          </p>
        </div>

        {/* Pestañas de Modo de Acceso */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'quick'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            ⚡ Acceso Rápido Aula
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'email'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            🔑 Correo y Contraseña
          </button>
        </div>

        {activeTab === 'quick' ? (
          <div className="space-y-3">
            {/* Botón Google Workspace */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50 text-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Acceder con Google Workspace</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                <span className="bg-white dark:bg-slate-900 px-2">O selecciona tu perfil docente</span>
              </div>
            </div>

            {/* Perfiles Rápidos para Dispositivos de Aula */}
            <div className="space-y-2">
              {Object.entries(DEFAULT_DEMO_USERS).map(([emailKey, user]) => (
                <button
                  key={emailKey}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin(emailKey)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700/80 transition-all flex items-center justify-between text-left group active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400">
                      {user.rol === 'admin' ? '👑' : user.rol === 'kitchen' ? '👨‍🍳' : '👩‍🏫'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {user.displayName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="profesor@sanbuenaventura.es"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>Iniciar Sesión</span>
            </button>
          </form>
        )}

        {/* Nota de Privacidad RGPD */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="flex items-center justify-center gap-1 text-[10.5px] font-semibold text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Protección RGPD y LOPDGDD activa</span>
          </div>
          <p className="text-[9.5px] text-slate-400/80 mt-0.5">
            Los datos de menores y alergias están protegidos y no son accesibles sin autenticación.
          </p>
        </div>
      </div>
    </div>
  );
};
