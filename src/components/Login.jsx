import React, { useState } from 'react';
import { supabase, ADMIN_EMAIL } from '../supabaseClient';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      setError('Access denied: Unauthorized email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;
      
      setMessage('Magic link sent! Check your email to log in.');
    } catch (err) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Admin Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={loading}
              aria-label="Email Address"
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
        {message && <p className="login-success">{message}</p>}
      </div>
    </div>
  );
};

export default Login;
