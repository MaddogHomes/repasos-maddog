import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const RepasosApp = dynamic(() => import('../components/RepasosApp'), { ssr: false });
const LoginScreen = dynamic(() => import('../components/LoginScreen'), { ssr: false });

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-sm text-stone-500">Cargando…</div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <RepasosApp session={session} />;
}
