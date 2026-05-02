import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Loader2 } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.toLowerCase().includes('invalid')) {
        setError('Email o contraseña incorrectos.');
      } else {
        setError(error.message || 'Error al iniciar sesión.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 bg-stone-900 text-white rounded flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">MADDOG HOMES</div>
            <div className="text-xs text-stone-500">Repasos de obra</div>
          </div>
        </div>

        <h1 className="text-lg font-bold mb-1">Iniciar sesión</h1>
        <p className="text-xs text-stone-500 mb-5">Accede con la cuenta que se te haya asignado.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Entrando…</> : 'Entrar'}
          </button>
        </form>

        <p className="text-[11px] text-stone-400 mt-5 text-center leading-relaxed">
          ¿No tienes cuenta? Pídesela al administrador del equipo.
        </p>
      </div>
    </div>
  );
}
