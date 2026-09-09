import { useState, useEffect } from 'react';
import { supabase, ADMIN_EMAIL } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const adminEmail = (ADMIN_EMAIL || 'onlineadeffect@gmail.com').toLowerCase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user?.email?.toLowerCase() === adminEmail) {
        setSession(session);
      } else if (session) {
        // Unauthorized user — sign them out
        supabase.auth.signOut();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user?.email?.toLowerCase() === adminEmail) {
        setSession(session);
      } else if (session) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = () => {
    setSession(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;
