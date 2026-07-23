import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(pin)) {
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      fontFamily: 'var(--font-family)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--primary-light)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: 'var(--primary-dark)'
        }}>
          <Lock size={32} />
        </div>
        
        <h2 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Welcome Back
        </h2>
        <p style={{ margin: '0 0 2rem', color: 'var(--text-secondary)' }}>
          Please enter your PIN to access the dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="Enter 6-digit PIN"
              maxLength={6}
              autoFocus
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.25rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
                border: `2px solid ${error ? '#ff4757' : 'var(--border-color)'}`,
                borderRadius: '12px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            {error && (
              <div style={{
                color: '#ff4757',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                fontSize: '0.9rem'
              }}>
                <AlertCircle size={16} />
                <span>Incorrect PIN. Please try again.</span>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            className="premium-btn"
            style={{ width: '100%', padding: '1rem' }}
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
